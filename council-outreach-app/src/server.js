const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Data file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const COUNCILS_FILE = path.join(DATA_DIR, 'councils.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const REGIONS_FILE = path.join(DATA_DIR, 'regions.json');

// Helper: Read JSON file
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (filePath === COUNCILS_FILE) return [];
    return {};
  }
}

// Helper: Write JSON file
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Helper: Get councils array
function getCouncils() {
  return readJSON(COUNCILS_FILE);
}

// Helper: Save councils array
function saveCouncils(councils) {
  writeJSON(COUNCILS_FILE, councils);
}

// Helper: Calculate next follow-up date based on last interaction
function calculateNextFollowUp(interactions, status) {
  if (status === 'active_client' || status === 'lost' || status === 'terms_agreed') {
    return null;
  }

  if (!interactions || interactions.length === 0) {
    return null;
  }

  const lastInteraction = interactions[interactions.length - 1];
  const lastDate = new Date(lastInteraction.date);
  const daysSinceLastInteraction = interactions.length;

  let daysToAdd;
  switch (daysSinceLastInteraction) {
    case 1: daysToAdd = 3; break;   // After 1st touch: follow up in 3 days
    case 2: daysToAdd = 4; break;   // After 2nd touch: follow up in 7 days (3+4)
    case 3: daysToAdd = 7; break;   // After 3rd touch: follow up in 14 days
    case 4: daysToAdd = 16; break;  // After 4th touch: follow up in 30 days
    default: daysToAdd = 30; break; // Ongoing: monthly check-ins
  }

  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate.toISOString().split('T')[0];
}

// Helper: Format status for display
function formatStatus(status) {
  const map = {
    'not_contacted': 'Not Contacted',
    'contacted': 'Contacted',
    'follow_up': 'Follow-up',
    'responded': 'Responded',
    'meeting_booked': 'Meeting Booked',
    'terms_agreed': 'Terms Agreed',
    'active_client': 'Active Client',
    'lost': 'Lost'
  };
  return map[status] || status;
}

// ============ API ROUTES ============

// GET /api/dashboard — Dashboard stats
app.get('/api/dashboard', (req, res) => {
  const councils = getCouncils();
  const today = new Date().toISOString().split('T')[0];

  const totalCouncils = councils.length;
  const statusCounts = {};
  let totalInteractions = 0;
  let overdueFollowUps = 0;
  let dueTodayFollowUps = 0;
  let dueThisWeek = 0;
  const recentActivity = [];

  const todayDate = new Date(today);
  const weekFromNow = new Date(todayDate);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  councils.forEach(council => {
    // Count by status
    statusCounts[council.status] = (statusCounts[council.status] || 0) + 1;

    // Count interactions
    if (council.interactions) {
      totalInteractions += council.interactions.length;

      // Collect recent activity
      council.interactions.slice(-3).forEach(interaction => {
        recentActivity.push({
          councilId: council.id,
          councilName: council.name,
          ...interaction
        });
      });
    }

    // Check follow-ups
    if (council.nextFollowUp) {
      const followUpDate = new Date(council.nextFollowUp);
      if (followUpDate < todayDate) overdueFollowUps++;
      if (council.nextFollowUp === today) dueTodayFollowUps++;
      if (followUpDate >= todayDate && followUpDate <= weekFromNow) dueThisWeek++;
    }
  });

  // Sort recent activity by date, newest first
  recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

  const contacted = (statusCounts['contacted'] || 0) + (statusCounts['follow_up'] || 0) +
    (statusCounts['responded'] || 0) + (statusCounts['meeting_booked'] || 0) +
    (statusCounts['terms_agreed'] || 0) + (statusCounts['active_client'] || 0);
  const responded = (statusCounts['responded'] || 0) + (statusCounts['meeting_booked'] || 0) +
    (statusCounts['terms_agreed'] || 0) + (statusCounts['active_client'] || 0);
  const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;

  res.json({
    totalCouncils,
    statusCounts,
    totalInteractions,
    overdueFollowUps,
    dueTodayFollowUps,
    dueThisWeek,
    responseRate,
    activeClients: statusCounts['active_client'] || 0,
    recentActivity: recentActivity.slice(0, 10)
  });
});

// GET /api/councils — List all councils with optional filters
app.get('/api/councils', (req, res) => {
  let councils = getCouncils();
  const { region, status, search, sort } = req.query;

  if (region) {
    councils = councils.filter(c => c.region === region);
  }
  if (status) {
    councils = councils.filter(c => c.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    councils = councils.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.contacts && c.contacts.some(ct => ct.name.toLowerCase().includes(q)))
    );
  }

  // Sort
  if (sort === 'name') {
    councils.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'status') {
    const order = ['not_contacted', 'contacted', 'follow_up', 'responded', 'meeting_booked', 'terms_agreed', 'active_client', 'lost'];
    councils.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  } else if (sort === 'followup') {
    councils.sort((a, b) => {
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return new Date(a.nextFollowUp) - new Date(b.nextFollowUp);
    });
  } else {
    // Default: most recently updated first
    councils.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  res.json(councils);
});

// POST /api/councils — Add new council
app.post('/api/councils', (req, res) => {
  const councils = getCouncils();
  const { name, region, type, website, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Council name is required' });
  }

  const council = {
    id: uuidv4(),
    name,
    region: region || '',
    type: type || '',
    website: website || '',
    status: 'not_contacted',
    contacts: [],
    interactions: [],
    nextFollowUp: null,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  councils.push(council);
  saveCouncils(councils);
  res.status(201).json(council);
});

// GET /api/councils/:id — Get council detail
app.get('/api/councils/:id', (req, res) => {
  const councils = getCouncils();
  const council = councils.find(c => c.id === req.params.id);
  if (!council) {
    return res.status(404).json({ error: 'Council not found' });
  }
  res.json(council);
});

// PUT /api/councils/:id — Update council
app.put('/api/councils/:id', (req, res) => {
  const councils = getCouncils();
  const index = councils.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Council not found' });
  }

  const { name, region, type, website, notes } = req.body;
  if (name !== undefined) councils[index].name = name;
  if (region !== undefined) councils[index].region = region;
  if (type !== undefined) councils[index].type = type;
  if (website !== undefined) councils[index].website = website;
  if (notes !== undefined) councils[index].notes = notes;
  councils[index].updatedAt = new Date().toISOString();

  saveCouncils(councils);
  res.json(councils[index]);
});

// DELETE /api/councils/:id — Delete council
app.delete('/api/councils/:id', (req, res) => {
  let councils = getCouncils();
  const index = councils.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Council not found' });
  }

  councils.splice(index, 1);
  saveCouncils(councils);
  res.json({ success: true });
});

// POST /api/councils/:id/contacts — Add contact to council
app.post('/api/councils/:id/contacts', (req, res) => {
  const councils = getCouncils();
  const council = councils.find(c => c.id === req.params.id);
  if (!council) {
    return res.status(404).json({ error: 'Council not found' });
  }

  const { name, role, department, email, phone, linkedin, isPrimary } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Contact name is required' });
  }

  const contact = {
    id: uuidv4(),
    name,
    role: role || '',
    department: department || 'Adult Social Care',
    email: email || '',
    phone: phone || '',
    linkedin: linkedin || '',
    isPrimary: isPrimary || false
  };

  // If this is primary, unset others
  if (contact.isPrimary) {
    council.contacts.forEach(c => c.isPrimary = false);
  }

  council.contacts.push(contact);
  council.updatedAt = new Date().toISOString();
  saveCouncils(councils);
  res.status(201).json(contact);
});

// PUT /api/councils/:id/contacts/:contactId — Update contact
app.put('/api/councils/:id/contacts/:contactId', (req, res) => {
  const councils = getCouncils();
  const council = councils.find(c => c.id === req.params.id);
  if (!council) {
    return res.status(404).json({ error: 'Council not found' });
  }

  const contact = council.contacts.find(c => c.id === req.params.contactId);
  if (!contact) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const { name, role, department, email, phone, linkedin, isPrimary } = req.body;
  if (name !== undefined) contact.name = name;
  if (role !== undefined) contact.role = role;
  if (department !== undefined) contact.department = department;
  if (email !== undefined) contact.email = email;
  if (phone !== undefined) contact.phone = phone;
  if (linkedin !== undefined) contact.linkedin = linkedin;
  if (isPrimary !== undefined) {
    if (isPrimary) council.contacts.forEach(c => c.isPrimary = false);
    contact.isPrimary = isPrimary;
  }

  council.updatedAt = new Date().toISOString();
  saveCouncils(councils);
  res.json(contact);
});

// DELETE /api/councils/:id/contacts/:contactId — Delete contact
app.delete('/api/councils/:id/contacts/:contactId', (req, res) => {
  const councils = getCouncils();
  const council = councils.find(c => c.id === req.params.id);
  if (!council) {
    return res.status(404).json({ error: 'Council not found' });
  }

  const index = council.contacts.findIndex(c => c.id === req.params.contactId);
  if (index === -1) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  council.contacts.splice(index, 1);
  council.updatedAt = new Date().toISOString();
  saveCouncils(councils);
  res.json({ success: true });
});

// POST /api/councils/:id/interactions — Log an interaction
app.post('/api/councils/:id/interactions', (req, res) => {
  const councils = getCouncils();
  const council = councils.find(c => c.id === req.params.id);
  if (!council) {
    return res.status(404).json({ error: 'Council not found' });
  }

  const { type, contactId, notes, templateUsed } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'Interaction type is required' });
  }

  const interaction = {
    id: uuidv4(),
    type,
    contactId: contactId || null,
    date: new Date().toISOString().split('T')[0],
    notes: notes || '',
    templateUsed: templateUsed || null
  };

  council.interactions.push(interaction);

  // Auto-advance status if still "not_contacted"
  if (council.status === 'not_contacted') {
    council.status = 'contacted';
  }

  // Recalculate next follow-up
  council.nextFollowUp = calculateNextFollowUp(council.interactions, council.status);
  council.updatedAt = new Date().toISOString();

  saveCouncils(councils);
  res.status(201).json({ interaction, council });
});

// PUT /api/councils/:id/status — Update pipeline status
app.put('/api/councils/:id/status', (req, res) => {
  const councils = getCouncils();
  const council = councils.find(c => c.id === req.params.id);
  if (!council) {
    return res.status(404).json({ error: 'Council not found' });
  }

  const { status } = req.body;
  const validStatuses = ['not_contacted', 'contacted', 'follow_up', 'responded', 'meeting_booked', 'terms_agreed', 'active_client', 'lost'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  council.status = status;
  council.nextFollowUp = calculateNextFollowUp(council.interactions, status);
  council.updatedAt = new Date().toISOString();

  saveCouncils(councils);
  res.json(council);
});

// GET /api/templates — Get all outreach templates
app.get('/api/templates', (req, res) => {
  const data = readJSON(TEMPLATES_FILE);
  const { category, targetRole } = req.query;

  let templates = data.templates || [];
  if (category) {
    templates = templates.filter(t => t.category === category);
  }
  if (targetRole) {
    templates = templates.filter(t => t.targetRole === targetRole || t.targetRole === 'Any');
  }
  res.json(templates);
});

// GET /api/followups — Get all due/overdue follow-ups
app.get('/api/followups', (req, res) => {
  const councils = getCouncils();
  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date(today);
  const weekFromNow = new Date(todayDate);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const { filter } = req.query; // 'overdue', 'today', 'week', 'all'

  const followups = [];
  councils.forEach(council => {
    if (!council.nextFollowUp) return;
    const followUpDate = new Date(council.nextFollowUp);

    const isOverdue = followUpDate < todayDate;
    const isToday = council.nextFollowUp === today;
    const isThisWeek = followUpDate >= todayDate && followUpDate <= weekFromNow;

    if (filter === 'overdue' && !isOverdue) return;
    if (filter === 'today' && !isToday) return;
    if (filter === 'week' && !isThisWeek) return;

    followups.push({
      councilId: council.id,
      councilName: council.name,
      region: council.region,
      status: council.status,
      nextFollowUp: council.nextFollowUp,
      isOverdue,
      isToday,
      contactCount: council.contacts.length,
      interactionCount: council.interactions.length,
      lastInteraction: council.interactions.length > 0 ? council.interactions[council.interactions.length - 1] : null,
      primaryContact: council.contacts.find(c => c.isPrimary) || council.contacts[0] || null
    });
  });

  // Sort: overdue first, then by date
  followups.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return new Date(a.nextFollowUp) - new Date(b.nextFollowUp);
  });

  res.json(followups);
});

// GET /api/pipeline — Get councils grouped by pipeline stage
app.get('/api/pipeline', (req, res) => {
  const councils = getCouncils();
  const stages = [
    'not_contacted', 'contacted', 'follow_up', 'responded',
    'meeting_booked', 'terms_agreed', 'active_client', 'lost'
  ];

  const pipeline = {};
  stages.forEach(stage => {
    pipeline[stage] = {
      label: formatStatus(stage),
      councils: councils
        .filter(c => c.status === stage)
        .map(c => ({
          id: c.id,
          name: c.name,
          region: c.region,
          contactCount: c.contacts.length,
          interactionCount: c.interactions.length,
          nextFollowUp: c.nextFollowUp,
          primaryContact: c.contacts.find(ct => ct.isPrimary) || c.contacts[0] || null
        }))
    };
  });

  // Conversion stats
  const total = councils.length;
  const contacted = councils.filter(c => c.status !== 'not_contacted').length;
  const responded = councils.filter(c => ['responded', 'meeting_booked', 'terms_agreed', 'active_client'].includes(c.status)).length;
  const meetings = councils.filter(c => ['meeting_booked', 'terms_agreed', 'active_client'].includes(c.status)).length;
  const won = councils.filter(c => c.status === 'active_client').length;

  res.json({
    pipeline,
    stats: {
      total,
      contacted,
      responded,
      meetings,
      won,
      contactedRate: total > 0 ? Math.round((contacted / total) * 100) : 0,
      responseRate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
      meetingRate: responded > 0 ? Math.round((meetings / responded) * 100) : 0,
      winRate: meetings > 0 ? Math.round((won / meetings) * 100) : 0
    }
  });
});

// GET /api/regions — Get UK regions list
app.get('/api/regions', (req, res) => {
  const data = readJSON(REGIONS_FILE);
  res.json(data);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n  Pro Social Partners — Council Outreach System`);
  console.log(`  Running on http://localhost:${PORT}\n`);
});
