// ─── State ───────────────────────────────────────────────────
let currentUser = null;
let currentPlan = null;
let notificationPermission = false;

// ─── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSavedUser();
  loadDailyQuote();
  setupNavigation();
  setupForm();
  requestNotificationPermission();
});

// ─── Navigation ─────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  // Load page-specific data
  if (page === 'plan' && currentUser) loadPlan();
  if (page === 'reminders' && currentUser) loadReminders();
  if (page === 'stats' && currentUser) loadStats();
}

// ─── Quote ──────────────────────────────────────────────────
async function loadDailyQuote() {
  try {
    const res = await fetch('/api/quote');
    const quote = await res.json();
    document.getElementById('quote-text').textContent = quote.text;
    document.getElementById('quote-author').textContent = `- ${quote.author}`;
  } catch (e) {
    console.error('Failed to load quote:', e);
  }
}

// ─── Profile Form ───────────────────────────────────────────
function setupForm() {
  // Goal selection
  document.querySelectorAll('.goal-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.goal-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Fitness level selection
  document.querySelectorAll('.level-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.level-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Form submit
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProfile();
  });
}

async function saveProfile() {
  const selectedGoal = document.querySelector('.goal-option.selected');
  const selectedLevel = document.querySelector('.level-option.selected');

  if (!selectedGoal) {
    showToast('Please select a fitness goal!', 'warning');
    return;
  }
  if (!selectedLevel) {
    showToast('Please select your fitness level!', 'warning');
    return;
  }

  const profile = {
    name: document.getElementById('name').value,
    age: document.getElementById('age').value,
    weight: document.getElementById('weight').value,
    weightUnit: document.getElementById('weight-unit').value,
    height: document.getElementById('height').value,
    heightUnit: document.getElementById('height-unit').value,
    gender: document.getElementById('gender').value,
    goal: selectedGoal.dataset.goal,
    fitnessLevel: selectedLevel.dataset.level,
    reminderTime: document.getElementById('reminder-time').value
  };

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const user = await res.json();
    if (user.error) {
      showToast(user.error, 'warning');
      return;
    }
    currentUser = user;
    localStorage.setItem('fitnessUserId', user.id);
    showToast(`Welcome, ${user.name}! Your plan is ready!`, 'success');

    // Schedule daily reminders
    scheduleBrowserReminders(user);

    // Navigate to plan
    setTimeout(() => navigateTo('plan'), 1000);
  } catch (e) {
    showToast('Failed to save profile. Please try again.', 'warning');
  }
}

// ─── Load Saved User ────────────────────────────────────────
async function loadSavedUser() {
  const userId = localStorage.getItem('fitnessUserId');
  if (!userId) {
    navigateTo('profile');
    return;
  }

  try {
    const res = await fetch(`/api/profile/${userId}`);
    if (!res.ok) {
      navigateTo('profile');
      return;
    }
    currentUser = await res.json();
    populateProfileForm(currentUser);
    navigateTo('home');
    loadPlan();
  } catch (e) {
    navigateTo('profile');
  }
}

function populateProfileForm(user) {
  document.getElementById('name').value = user.name || '';
  document.getElementById('age').value = user.age || '';
  document.getElementById('weight').value = user.weight || '';
  document.getElementById('weight-unit').value = user.weightUnit || 'kg';
  document.getElementById('height').value = user.height || '';
  document.getElementById('height-unit').value = user.heightUnit || 'cm';
  document.getElementById('gender').value = user.gender || 'other';
  document.getElementById('reminder-time').value = user.reminderTime || '08:00';

  // Select goal
  const goalOpt = document.querySelector(`.goal-option[data-goal="${user.goal}"]`);
  if (goalOpt) goalOpt.classList.add('selected');

  // Select level
  const levelOpt = document.querySelector(`.level-option[data-level="${user.fitnessLevel}"]`);
  if (levelOpt) levelOpt.classList.add('selected');
}

// ─── Fitness Plan ───────────────────────────────────────────
async function loadPlan() {
  if (!currentUser) return;

  try {
    const res = await fetch(`/api/plan/${currentUser.id}`);
    const plan = await res.json();
    currentPlan = plan;
    renderPlan(plan);
  } catch (e) {
    console.error('Failed to load plan:', e);
  }
}

function renderPlan(plan) {
  const container = document.getElementById('plan-content');

  // Summary
  let html = `
    <div class="plan-summary">
      <div class="summary-stat">
        <div class="stat-value">${plan.summary.workoutDaysPerWeek}</div>
        <div class="stat-label">Workout Days</div>
      </div>
      <div class="summary-stat">
        <div class="stat-value">${plan.summary.restDaysPerWeek}</div>
        <div class="stat-label">Rest Days</div>
      </div>
      <div class="summary-stat">
        <div class="stat-value">${plan.summary.estimatedWeeklyCaloriesBurned}</div>
        <div class="stat-label">Cal/Week</div>
      </div>
    </div>
  `;

  // Recommendations
  html += `<div class="card" style="margin-bottom: 16px;">
    <div class="card-header">
      <span class="icon">&#128161;</span>
      <span class="card-title">Coach Tips for You</span>
    </div>
    <ul style="padding-left: 20px;">
      ${plan.summary.recommendation.map(r => `<li style="margin-bottom: 6px; font-size: 0.9rem;">${r}</li>`).join('')}
    </ul>
  </div>`;

  // Daily plan
  plan.weeklyPlan.forEach((day, index) => {
    html += `
      <div class="day-card">
        <div class="day-header" onclick="toggleDay(${index})">
          <span class="day-name">${day.day}</span>
          <span class="day-badge ${day.isRestDay ? 'badge-rest' : 'badge-workout'}">
            ${day.isRestDay ? 'Rest Day' : `${day.exercises.length} exercises ~ ${day.estimatedCalories} cal`}
          </span>
        </div>
        <div class="day-exercises" id="day-${index}">
    `;

    if (day.isRestDay) {
      html += `<p style="padding: 8px 0; color: var(--gray);">${day.tip}</p>`;
    } else {
      day.exercises.forEach(ex => {
        const detail = ex.duration
          ? ex.duration
          : `${ex.sets} x ${ex.reps}`;
        html += `
          <div class="exercise-item">
            <div>
              <div class="exercise-name">${ex.name}</div>
              <div class="exercise-detail">${detail} &bull; ${ex.type}</div>
            </div>
            <div class="exercise-calories">${ex.calories} cal</div>
          </div>
        `;
      });
      html += `<div class="day-tip">&#128172; ${day.tip}</div>`;
      html += `
        <button class="btn btn-success btn-small complete-workout-btn"
                onclick="completeWorkout('${day.day}', ${index})">
          Mark ${day.day} Complete
        </button>
      `;
    }

    html += '</div></div>';
  });

  container.innerHTML = html;
}

function toggleDay(index) {
  const el = document.getElementById(`day-${index}`);
  el.classList.toggle('open');
}

async function completeWorkout(day, index) {
  if (!currentUser || !currentPlan) return;

  const dayPlan = currentPlan.weeklyPlan[index];
  try {
    const res = await fetch('/api/workout/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        day,
        exercises: dayPlan.exercises
      })
    });
    const result = await res.json();
    showToast(`${day} workout complete! Streak: ${result.streak} days`, 'success');
  } catch (e) {
    showToast('Failed to log workout.', 'warning');
  }
}

// ─── Reminders ──────────────────────────────────────────────
async function loadReminders() {
  if (!currentUser) return;

  try {
    const res = await fetch(`/api/reminders/${currentUser.id}`);
    const data = await res.json();
    renderReminders(data);
  } catch (e) {
    console.error('Failed to load reminders:', e);
  }
}

function renderReminders(data) {
  const container = document.getElementById('reminders-content');

  const icons = {
    workout: '&#127947;',
    hydration: '&#128167;',
    motivation: '&#11088;',
    nutrition: '&#129367;',
    sleep: '&#128164;'
  };

  const labels = {
    workout: 'Workout Reminder',
    hydration: 'Hydration Check',
    motivation: 'Daily Motivation',
    nutrition: 'Nutrition Tip',
    sleep: 'Sleep Reminder'
  };

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let html = `<h3 style="margin-bottom: 16px;">Today's Schedule - ${data.today}</h3>`;
  html += '<div class="reminder-list">';

  data.reminders
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .forEach(r => {
      const rMinutes = timeToMinutes(r.time);
      const isActive = Math.abs(currentMinutes - rMinutes) < 60;
      const isPast = currentMinutes > rMinutes + 30;

      html += `
        <div class="reminder-item ${isActive ? 'reminder-active' : ''}" style="${isPast ? 'opacity:0.6' : ''}">
          <span class="reminder-icon">${icons[r.type] || '&#128276;'}</span>
          <div class="reminder-content">
            <div class="reminder-time">${r.time} &bull; ${labels[r.type] || r.type}</div>
            <div class="reminder-message">${r.message}</div>
          </div>
        </div>
      `;
    });

  html += '</div>';
  container.innerHTML = html;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// ─── Stats ──────────────────────────────────────────────────
async function loadStats() {
  if (!currentUser) return;

  try {
    const res = await fetch(`/api/stats/${currentUser.id}`);
    const stats = await res.json();
    renderStats(stats);
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

function renderStats(stats) {
  const container = document.getElementById('stats-content');

  const bmiPercent = Math.min((stats.bmi / 40) * 100, 100);

  let html = `
    <div class="streak-display">
      &#128293; ${stats.currentStreak} Day Streak! Keep it going!
    </div>
    <div class="stats-grid">
      <div class="stat-card stat-purple">
        <div class="stat-icon">&#127942;</div>
        <div class="stat-number">${stats.totalWorkouts}</div>
        <div class="stat-text">Total Workouts</div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-icon">&#128293;</div>
        <div class="stat-number">${stats.totalCaloriesBurned}</div>
        <div class="stat-text">Calories Burned</div>
      </div>
      <div class="stat-card stat-orange">
        <div class="stat-icon">&#128197;</div>
        <div class="stat-number">${stats.thisWeekWorkouts}</div>
        <div class="stat-text">This Week</div>
      </div>
      <div class="stat-card stat-blue">
        <div class="stat-icon">&#128336;</div>
        <div class="stat-number">${new Date(stats.memberSince).toLocaleDateString()}</div>
        <div class="stat-text">Member Since</div>
      </div>
    </div>
    <div class="bmi-display">
      <div class="bmi-value">${stats.bmi}</div>
      <div class="bmi-label">BMI - ${stats.bmiCategory}</div>
      <div class="bmi-bar">
        <div class="bmi-fill" style="width: ${bmiPercent}%"></div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ─── Browser Notifications ──────────────────────────────────
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      notificationPermission = perm === 'granted';
    });
  } else if ('Notification' in window) {
    notificationPermission = Notification.permission === 'granted';
  }
}

function scheduleBrowserReminders(user) {
  if (!notificationPermission) return;

  // Check every minute for reminder times
  setInterval(() => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (timeStr === user.reminderTime) {
      new Notification('Fitness Trainer', {
        body: `Time for your workout, ${user.name}! Let's get moving!`,
        icon: '/images/icon.png'
      });
    }
    if (timeStr === '07:00') {
      fetch('/api/quote')
        .then(r => r.json())
        .then(q => {
          new Notification('Daily Motivation', {
            body: `"${q.text}" - ${q.author}`,
            icon: '/images/icon.png'
          });
        });
    }
    if (timeStr === '10:00') {
      new Notification('Hydration Reminder', {
        body: 'Stay hydrated! Drink a glass of water now.',
        icon: '/images/icon.png'
      });
    }
    if (timeStr === '21:00') {
      new Notification('Sleep Reminder', {
        body: 'Time to wind down. Get 7-9 hours of sleep tonight!',
        icon: '/images/icon.png'
      });
    }
  }, 60000);
}

// ─── Toast ──────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}
