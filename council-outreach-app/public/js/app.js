// ============ STATE ============
let allCouncils = [];
let allTemplates = [];
let regionsData = null;
let currentCouncilId = null;
let currentTemplateBody = '';

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  loadRegions();
  loadTemplates();
  loadDashboard();
});

// ============ NAVIGATION ============
function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Deactivate all nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Show target page
  const targetPage = document.getElementById('page-' + page);
  if (targetPage) targetPage.classList.add('active');

  // Activate nav button
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Load page data
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'councils': loadCouncils(); break;
    case 'templates': loadTemplatesPage(); break;
    case 'followups': loadFollowUps(); break;
    case 'pipeline': loadPipeline(); break;
  }
}

// ============ DASHBOARD ============
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();

    document.getElementById('stat-total').textContent = data.totalCouncils;
    document.getElementById('stat-active').textContent = data.activeClients;
    document.getElementById('stat-response-rate').textContent = data.responseRate + '%';
    document.getElementById('stat-overdue').textContent = data.overdueFollowUps;
    document.getElementById('badge-today').textContent = data.dueTodayFollowUps;

    // Follow-ups due today
    const todayContainer = document.getElementById('followups-today');
    if (data.dueTodayFollowUps === 0 && data.overdueFollowUps === 0) {
      todayContainer.innerHTML = '<p class="empty-state">No follow-ups due today. You\'re all caught up!</p>';
    } else {
      const followRes = await fetch('/api/followups?filter=today');
      const overdueRes = await fetch('/api/followups?filter=overdue');
      const todayItems = await followRes.json();
      const overdueItems = await overdueRes.json();
      const items = [...overdueItems, ...todayItems].slice(0, 5);
      todayContainer.innerHTML = items.map(item => renderFollowUpItem(item)).join('');
    }

    // Recent activity
    const activityContainer = document.getElementById('recent-activity');
    if (data.recentActivity.length === 0) {
      activityContainer.innerHTML = '<p class="empty-state">No activity yet. Start adding councils and logging outreach!</p>';
    } else {
      activityContainer.innerHTML = data.recentActivity.map(a => `
        <div class="activity-item">
          <span class="activity-icon">${getInteractionIcon(a.type)}</span>
          <div class="activity-info">
            <strong>${a.councilName}</strong>
            <span class="activity-detail">${a.notes || formatInteractionType(a.type)}</span>
          </div>
          <span class="activity-date">${formatDate(a.date)}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ============ COUNCILS ============
async function loadCouncils() {
  try {
    const search = document.getElementById('council-search')?.value || '';
    const region = document.getElementById('council-region-filter')?.value || '';
    const status = document.getElementById('council-status-filter')?.value || '';

    let url = '/api/councils?sort=name';
    if (search) url += '&search=' + encodeURIComponent(search);
    if (region) url += '&region=' + encodeURIComponent(region);
    if (status) url += '&status=' + encodeURIComponent(status);

    const res = await fetch(url);
    allCouncils = await res.json();

    const container = document.getElementById('councils-list');
    if (allCouncils.length === 0) {
      container.innerHTML = '<p class="empty-state">No councils found. Click \'+ Add Council\' to get started!</p>';
      return;
    }

    container.innerHTML = allCouncils.map(council => `
      <div class="council-card" onclick="viewCouncil('${council.id}')">
        <div class="council-card-header">
          <h4>${council.name}</h4>
          <span class="status-badge status-${council.status}">${formatStatus(council.status)}</span>
        </div>
        <div class="council-card-meta">
          ${council.region ? `<span class="meta-item">${council.region}</span>` : ''}
          ${council.type ? `<span class="meta-item">${council.type}</span>` : ''}
        </div>
        <div class="council-card-stats">
          <span>${council.contacts.length} contact${council.contacts.length !== 1 ? 's' : ''}</span>
          <span>${council.interactions.length} interaction${council.interactions.length !== 1 ? 's' : ''}</span>
          ${council.nextFollowUp ? `<span class="${isOverdue(council.nextFollowUp) ? 'text-danger' : ''}">Follow-up: ${formatDate(council.nextFollowUp)}</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load councils:', err);
  }
}

function filterCouncils() {
  loadCouncils();
}

async function viewCouncil(id) {
  currentCouncilId = id;
  try {
    const res = await fetch(`/api/councils/${id}`);
    const council = await res.json();

    navigateTo('council-detail');

    const container = document.getElementById('council-detail-content');
    container.innerHTML = `
      <div class="detail-header">
        <h2>${council.name}</h2>
        <span class="status-badge status-${council.status} large">${formatStatus(council.status)}</span>
      </div>

      <div class="detail-meta">
        ${council.region ? `<span class="meta-tag">${council.region}</span>` : ''}
        ${council.type ? `<span class="meta-tag">${council.type}</span>` : ''}
        ${council.website ? `<a href="${council.website}" target="_blank" class="meta-tag meta-link">Website</a>` : ''}
      </div>

      ${council.notes ? `<div class="detail-notes"><p>${council.notes}</p></div>` : ''}

      <!-- Status Update -->
      <div class="card">
        <div class="card-header">
          <h3>Pipeline Status</h3>
        </div>
        <div class="status-selector">
          ${['not_contacted', 'contacted', 'follow_up', 'responded', 'meeting_booked', 'terms_agreed', 'active_client', 'lost'].map(s => `
            <button class="btn btn-status ${council.status === s ? 'active' : ''}" onclick="updateCouncilStatus('${id}', '${s}')">${formatStatus(s)}</button>
          `).join('')}
        </div>
      </div>

      <!-- Contacts -->
      <div class="card">
        <div class="card-header">
          <h3>Contacts</h3>
          <button class="btn btn-sm btn-primary" onclick="showAddContactModal('${id}')">+ Add Contact</button>
        </div>
        <div class="contacts-list">
          ${council.contacts.length === 0 ? '<p class="empty-state">No contacts yet. Add your first contact to start outreach.</p>' :
            council.contacts.map(contact => `
              <div class="contact-item">
                <div class="contact-info">
                  <strong>${contact.name}</strong> ${contact.isPrimary ? '<span class="badge badge-primary">Primary</span>' : ''}
                  <div class="contact-details">
                    ${contact.role ? `<span>${contact.role}</span>` : ''}
                    ${contact.department ? `<span>${contact.department}</span>` : ''}
                  </div>
                  <div class="contact-channels">
                    ${contact.email ? `<a href="mailto:${contact.email}" class="channel-link">Email</a>` : ''}
                    ${contact.phone ? `<a href="tel:${contact.phone}" class="channel-link">Phone</a>` : ''}
                    ${contact.linkedin ? `<a href="${contact.linkedin.startsWith('http') ? contact.linkedin : 'https://' + contact.linkedin}" target="_blank" class="channel-link">LinkedIn</a>` : ''}
                  </div>
                </div>
                <button class="btn btn-sm btn-ghost" onclick="deleteContact('${id}', '${contact.id}')">Remove</button>
              </div>
            `).join('')}
        </div>
      </div>

      <!-- Log Interaction -->
      <div class="card">
        <div class="card-header">
          <h3>Interaction History</h3>
          <button class="btn btn-sm btn-primary" onclick="showLogInteractionModal('${id}')">+ Log Interaction</button>
        </div>
        ${council.nextFollowUp ? `
          <div class="next-followup ${isOverdue(council.nextFollowUp) ? 'overdue' : ''}">
            Next follow-up: <strong>${formatDate(council.nextFollowUp)}</strong>
            ${isOverdue(council.nextFollowUp) ? ' <span class="text-danger">(OVERDUE)</span>' : ''}
          </div>
        ` : ''}
        <div class="interactions-timeline">
          ${council.interactions.length === 0 ? '<p class="empty-state">No interactions logged yet.</p>' :
            [...council.interactions].reverse().map(interaction => `
              <div class="timeline-item">
                <span class="timeline-icon">${getInteractionIcon(interaction.type)}</span>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <strong>${formatInteractionType(interaction.type)}</strong>
                    <span class="timeline-date">${formatDate(interaction.date)}</span>
                  </div>
                  ${interaction.notes ? `<p class="timeline-notes">${interaction.notes}</p>` : ''}
                  ${interaction.templateUsed ? `<span class="template-tag">Template: ${interaction.templateUsed}</span>` : ''}
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load council:', err);
  }
}

function showAddCouncilModal(editId) {
  document.getElementById('modal-council-title').textContent = editId ? 'Edit Council' : 'Add Council';
  document.getElementById('council-edit-id').value = editId || '';

  if (!editId) {
    document.getElementById('form-council').reset();
  }

  openModal('modal-council');
}

async function saveCouncil(event) {
  event.preventDefault();
  const editId = document.getElementById('council-edit-id').value;
  const data = {
    name: document.getElementById('council-name').value,
    region: document.getElementById('council-region').value,
    type: document.getElementById('council-type').value,
    website: document.getElementById('council-website').value,
    notes: document.getElementById('council-notes').value
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`/api/councils/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch('/api/councils', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    if (res.ok) {
      closeModal('modal-council');
      showToast(editId ? 'Council updated!' : 'Council added!');
      loadCouncils();
      if (editId) viewCouncil(editId);
    }
  } catch (err) {
    console.error('Failed to save council:', err);
    showToast('Error saving council', 'error');
  }
}

async function editCurrentCouncil() {
  if (!currentCouncilId) return;
  try {
    const res = await fetch(`/api/councils/${currentCouncilId}`);
    const council = await res.json();

    document.getElementById('council-name').value = council.name;
    document.getElementById('council-region').value = council.region;
    document.getElementById('council-type').value = council.type;
    document.getElementById('council-website').value = council.website;
    document.getElementById('council-notes').value = council.notes;

    showAddCouncilModal(currentCouncilId);
  } catch (err) {
    console.error('Failed to load council for edit:', err);
  }
}

async function deleteCurrentCouncil() {
  if (!currentCouncilId) return;
  if (!confirm('Are you sure you want to delete this council? This cannot be undone.')) return;

  try {
    const res = await fetch(`/api/councils/${currentCouncilId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Council deleted');
      navigateTo('councils');
    }
  } catch (err) {
    console.error('Failed to delete council:', err);
  }
}

async function updateCouncilStatus(councilId, status) {
  try {
    const res = await fetch(`/api/councils/${councilId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showToast('Status updated to ' + formatStatus(status));
      viewCouncil(councilId);
    }
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

// ============ CONTACTS ============
function showAddContactModal(councilId) {
  document.getElementById('form-contact').reset();
  document.getElementById('contact-council-id').value = councilId;
  document.getElementById('contact-edit-id').value = '';
  document.getElementById('contact-department').value = 'Adult Social Care';
  openModal('modal-contact');
}

async function saveContact(event) {
  event.preventDefault();
  const councilId = document.getElementById('contact-council-id').value;
  const editId = document.getElementById('contact-edit-id').value;
  const data = {
    name: document.getElementById('contact-name').value,
    role: document.getElementById('contact-role').value,
    department: document.getElementById('contact-department').value,
    email: document.getElementById('contact-email').value,
    phone: document.getElementById('contact-phone').value,
    linkedin: document.getElementById('contact-linkedin').value,
    isPrimary: document.getElementById('contact-primary').checked
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`/api/councils/${councilId}/contacts/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch(`/api/councils/${councilId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    if (res.ok) {
      closeModal('modal-contact');
      showToast('Contact saved!');
      viewCouncil(councilId);
    }
  } catch (err) {
    console.error('Failed to save contact:', err);
    showToast('Error saving contact', 'error');
  }
}

async function deleteContact(councilId, contactId) {
  if (!confirm('Remove this contact?')) return;
  try {
    const res = await fetch(`/api/councils/${councilId}/contacts/${contactId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Contact removed');
      viewCouncil(councilId);
    }
  } catch (err) {
    console.error('Failed to delete contact:', err);
  }
}

// ============ INTERACTIONS ============
async function showLogInteractionModal(councilId) {
  document.getElementById('form-interaction').reset();
  document.getElementById('interaction-council-id').value = councilId;

  // Populate contacts dropdown
  try {
    const res = await fetch(`/api/councils/${councilId}`);
    const council = await res.json();
    const contactSelect = document.getElementById('interaction-contact');
    contactSelect.innerHTML = '<option value="">Select contact...</option>';
    council.contacts.forEach(c => {
      contactSelect.innerHTML += `<option value="${c.id}">${c.name} — ${c.role || 'No role'}</option>`;
    });
  } catch (err) {
    console.error('Failed to load contacts:', err);
  }

  // Populate templates dropdown
  const templateSelect = document.getElementById('interaction-template');
  templateSelect.innerHTML = '<option value="">None / Custom</option>';
  allTemplates.forEach(t => {
    templateSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });

  openModal('modal-interaction');
}

async function saveInteraction(event) {
  event.preventDefault();
  const councilId = document.getElementById('interaction-council-id').value;
  const data = {
    type: document.getElementById('interaction-type').value,
    contactId: document.getElementById('interaction-contact').value || null,
    notes: document.getElementById('interaction-notes').value,
    templateUsed: document.getElementById('interaction-template').value || null
  };

  try {
    const res = await fetch(`/api/councils/${councilId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      closeModal('modal-interaction');
      showToast('Interaction logged!');
      viewCouncil(councilId);
    }
  } catch (err) {
    console.error('Failed to log interaction:', err);
    showToast('Error logging interaction', 'error');
  }
}

// ============ TEMPLATES ============
async function loadTemplates() {
  try {
    const res = await fetch('/api/templates');
    allTemplates = await res.json();
  } catch (err) {
    console.error('Failed to load templates:', err);
  }
}

function loadTemplatesPage() {
  renderTemplates(allTemplates);
}

function filterTemplates(category, btn) {
  document.querySelectorAll('.template-filters .btn-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (category === 'all') {
    renderTemplates(allTemplates);
  } else {
    renderTemplates(allTemplates.filter(t => t.category === category));
  }
}

function renderTemplates(templates) {
  const container = document.getElementById('templates-list');
  if (templates.length === 0) {
    container.innerHTML = '<p class="empty-state">No templates found.</p>';
    return;
  }

  container.innerHTML = templates.map(t => `
    <div class="template-card" onclick="previewTemplate('${t.id}')">
      <div class="template-card-header">
        <span class="template-channel">${getChannelIcon(t.channel)} ${t.channel}</span>
        <span class="template-category badge badge-${t.category === 'initial' ? 'primary' : t.category === 'followup' ? 'warning' : 'success'}">${t.category}</span>
      </div>
      <h4>${t.name}</h4>
      <p class="template-target">For: ${t.targetRole}</p>
      ${t.subject ? `<p class="template-subject">Subject: ${t.subject}</p>` : ''}
      <p class="template-preview">${t.body.substring(0, 120)}...</p>
    </div>
  `).join('');
}

function previewTemplate(templateId) {
  const template = allTemplates.find(t => t.id === templateId);
  if (!template) return;

  document.getElementById('template-preview-title').textContent = template.name;
  currentTemplateBody = template.body;

  document.getElementById('template-preview-content').innerHTML = `
    ${template.subject ? `<div class="preview-field"><label>Subject:</label><p>${template.subject}</p></div>` : ''}
    <div class="preview-field"><label>Channel:</label><p>${getChannelIcon(template.channel)} ${template.channel}</p></div>
    <div class="preview-field"><label>Target:</label><p>${template.targetRole}</p></div>
    <div class="preview-body">
      <label>Message:</label>
      <pre class="preview-text">${template.body}</pre>
    </div>
    ${template.notes ? `<div class="preview-notes"><label>Pro Tips:</label><p>${template.notes}</p></div>` : ''}
  `;

  openModal('modal-template');
}

function copyTemplateToClipboard() {
  navigator.clipboard.writeText(currentTemplateBody).then(() => {
    showToast('Template copied to clipboard!');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = currentTemplateBody;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Template copied to clipboard!');
  });
}

// ============ FOLLOW-UPS ============
async function loadFollowUps(filter) {
  try {
    const url = filter && filter !== 'all' ? `/api/followups?filter=${filter}` : '/api/followups';
    const res = await fetch(url);
    const followups = await res.json();

    const container = document.getElementById('followups-list');
    if (followups.length === 0) {
      container.innerHTML = '<p class="empty-state">No follow-ups scheduled. Add councils and log interactions to get started.</p>';
      return;
    }

    container.innerHTML = followups.map(item => renderFollowUpItem(item, true)).join('');
  } catch (err) {
    console.error('Failed to load follow-ups:', err);
  }
}

function filterFollowUps(filter, btn) {
  document.querySelectorAll('.followup-filters .btn-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadFollowUps(filter);
}

function renderFollowUpItem(item, showDetails) {
  return `
    <div class="followup-item ${item.isOverdue ? 'overdue' : ''}" onclick="viewCouncil('${item.councilId}')">
      <div class="followup-main">
        <strong>${item.councilName}</strong>
        <span class="status-badge status-${item.status} small">${formatStatus(item.status)}</span>
      </div>
      <div class="followup-meta">
        <span class="${item.isOverdue ? 'text-danger' : ''}">${item.isOverdue ? 'OVERDUE: ' : ''}${formatDate(item.nextFollowUp)}</span>
        ${item.region ? `<span>${item.region}</span>` : ''}
        ${showDetails && item.primaryContact ? `<span>Contact: ${item.primaryContact.name}</span>` : ''}
      </div>
      ${showDetails && item.lastInteraction ? `
        <div class="followup-last">
          Last: ${getInteractionIcon(item.lastInteraction.type)} ${formatInteractionType(item.lastInteraction.type)} on ${formatDate(item.lastInteraction.date)}
        </div>
      ` : ''}
    </div>
  `;
}

// ============ PIPELINE ============
async function loadPipeline() {
  try {
    const res = await fetch('/api/pipeline');
    const data = await res.json();

    // Stats bar
    const statsContainer = document.getElementById('pipeline-stats');
    statsContainer.innerHTML = `
      <div class="pipeline-stat">
        <span class="pipeline-stat-number">${data.stats.total}</span>
        <span class="pipeline-stat-label">Total</span>
      </div>
      <div class="pipeline-stat">
        <span class="pipeline-stat-number">${data.stats.contactedRate}%</span>
        <span class="pipeline-stat-label">Contacted</span>
      </div>
      <div class="pipeline-stat">
        <span class="pipeline-stat-number">${data.stats.responseRate}%</span>
        <span class="pipeline-stat-label">Response Rate</span>
      </div>
      <div class="pipeline-stat">
        <span class="pipeline-stat-number">${data.stats.meetingRate}%</span>
        <span class="pipeline-stat-label">Meeting Rate</span>
      </div>
      <div class="pipeline-stat">
        <span class="pipeline-stat-number">${data.stats.winRate}%</span>
        <span class="pipeline-stat-label">Win Rate</span>
      </div>
    `;

    // Pipeline board
    const boardContainer = document.getElementById('pipeline-board');
    const stages = Object.entries(data.pipeline);
    boardContainer.innerHTML = stages.map(([key, stage]) => `
      <div class="pipeline-column">
        <div class="pipeline-column-header">
          <h4>${stage.label}</h4>
          <span class="badge">${stage.councils.length}</span>
        </div>
        <div class="pipeline-column-body">
          ${stage.councils.length === 0 ? '<p class="pipeline-empty">No councils</p>' :
            stage.councils.map(c => `
              <div class="pipeline-card" onclick="viewCouncil('${c.id}')">
                <strong>${c.name}</strong>
                ${c.region ? `<span class="pipeline-card-region">${c.region}</span>` : ''}
                <div class="pipeline-card-stats">
                  <span>${c.contactCount} contacts</span>
                  <span>${c.interactionCount} touches</span>
                </div>
                ${c.nextFollowUp ? `<span class="pipeline-card-followup ${isOverdue(c.nextFollowUp) ? 'text-danger' : ''}">Follow-up: ${formatDate(c.nextFollowUp)}</span>` : ''}
              </div>
            `).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load pipeline:', err);
  }
}

// ============ REGIONS ============
async function loadRegions() {
  try {
    const res = await fetch('/api/regions');
    regionsData = await res.json();

    // Populate region dropdowns
    const regionOptions = regionsData.regions.map(r => `<option value="${r.name}">${r.name}</option>`).join('');

    const filterSelect = document.getElementById('council-region-filter');
    if (filterSelect) filterSelect.innerHTML = '<option value="">All Regions</option>' + regionOptions;

    const formSelect = document.getElementById('council-region');
    if (formSelect) formSelect.innerHTML = '<option value="">Select region...</option>' + regionOptions;
  } catch (err) {
    console.error('Failed to load regions:', err);
  }
}

// ============ MODALS ============
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  document.body.style.overflow = '';
}

// ============ TOAST ============
function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (type === 'error' ? ' toast-error' : '');
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ============ HELPERS ============
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().split('T')[0];
  return dateStr < today;
}

function formatInteractionType(type) {
  const map = {
    'email': 'Email Sent',
    'phone': 'Phone Call',
    'linkedin': 'LinkedIn Message',
    'meeting': 'Meeting',
    'video_call': 'Video Call',
    'event': 'Event'
  };
  return map[type] || type;
}

function getInteractionIcon(type) {
  const map = {
    'email': '&#9993;',
    'phone': '&#9742;',
    'linkedin': '&#128101;',
    'meeting': '&#127970;',
    'video_call': '&#128249;',
    'event': '&#127915;'
  };
  return map[type] || '&#9679;';
}

function getChannelIcon(channel) {
  const map = {
    'email': '&#9993;',
    'linkedin': '&#128101;',
    'phone': '&#9742;'
  };
  return map[channel] || '';
}
