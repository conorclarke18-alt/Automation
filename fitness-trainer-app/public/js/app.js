const app = {
  userId: localStorage.getItem('fitcoach_userId'),
  profile: null,
  currentPage: 'home',
  timerInterval: null,
  timerSeconds: 120,
  timerRemaining: 120,
  timerRunning: false,

  // ===== Init =====
  async init() {
    this.setupOptionGrids();
    this.setupProfileForm();
    this.loadQuote();

    if (this.userId) {
      try {
        const res = await fetch(`/api/profile/${this.userId}`);
        if (res.ok) {
          this.profile = await res.json();
          this.showDashboard();
        } else {
          this.userId = null;
          localStorage.removeItem('fitcoach_userId');
        }
      } catch {
        // offline fallback
      }
    }
  },

  // ===== Navigation =====
  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navBtn) navBtn.classList.add('active');

    this.currentPage = page;

    // Load page data
    if (page === 'plan' && this.userId) this.loadPlan();
    if (page === 'stats' && this.userId) this.loadStats();
    if (page === 'profile' && this.profile) this.populateProfileForm();
  },

  // ===== Quote =====
  async loadQuote() {
    try {
      const res = await fetch('/api/quote');
      const quote = await res.json();
      document.getElementById('quoteBanner').textContent = `"${quote.text}" — ${quote.author}`;
    } catch { /* ignore */ }
  },

  // ===== Profile =====
  setupOptionGrids() {
    document.querySelectorAll('.option-grid').forEach(grid => {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.option-btn');
        if (!btn) return;
        grid.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  },

  setupProfileForm() {
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const goal = document.querySelector('#goalGrid .option-btn.selected')?.dataset.value;
      const level = document.querySelector('#levelGrid .option-btn.selected')?.dataset.value;

      if (!goal) return this.toast('Please select a fitness goal', 'error');
      if (!level) return this.toast('Please select your fitness level', 'error');

      const body = {
        userId: this.userId,
        name: document.getElementById('name').value.trim(),
        age: +document.getElementById('age').value,
        weight: +document.getElementById('weight').value,
        weightUnit: document.getElementById('weightUnit').value,
        height: +document.getElementById('height').value,
        heightUnit: document.getElementById('heightUnit').value,
        gender: document.getElementById('gender').value,
        goal, level,
        reminderTime: document.getElementById('reminderTime').value
      };

      try {
        const res = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.userId) {
          this.userId = data.userId;
          this.profile = data.profile;
          localStorage.setItem('fitcoach_userId', data.userId);
          this.toast('Profile saved!', 'success');
          this.showDashboard();
          this.navigate('home');
        }
      } catch {
        this.toast('Failed to save profile', 'error');
      }
    });
  },

  populateProfileForm() {
    if (!this.profile) return;
    const p = this.profile;
    document.getElementById('name').value = p.name || '';
    document.getElementById('age').value = p.age || '';
    document.getElementById('weight').value = p.weight || '';
    document.getElementById('weightUnit').value = p.weightUnit || 'kg';
    document.getElementById('height').value = p.height || '';
    document.getElementById('heightUnit').value = p.heightUnit || 'cm';
    document.getElementById('gender').value = p.gender || 'other';
    document.getElementById('reminderTime').value = p.reminderTime || '08:00';

    // Select goal/level buttons
    document.querySelectorAll('#goalGrid .option-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.value === p.goal);
    });
    document.querySelectorAll('#levelGrid .option-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.value === p.level);
    });
  },

  // ===== Dashboard =====
  async showDashboard() {
    document.getElementById('welcomeSection').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';

    document.getElementById('greetingMsg').textContent = `${greeting}, ${this.profile.name}!`;

    const goalLabels = {
      lose_weight: 'Lose weight',
      build_muscle: 'Build muscle',
      improve_endurance: 'Improve endurance',
      stay_fit: 'Stay fit'
    };
    document.getElementById('greetingSubtext').textContent = `Goal: ${goalLabels[this.profile.goal] || 'Stay fit'} · ${this.profile.level}`;

    // Load quick stats
    try {
      const res = await fetch(`/api/stats/${this.userId}`);
      const stats = await res.json();
      document.getElementById('streakCount').textContent = stats.streak || 0;
      document.getElementById('qsWorkouts').textContent = stats.totalWorkouts || 0;
      document.getElementById('qsCalories').textContent = stats.totalCalories || 0;
      document.getElementById('qsThisWeek').textContent = stats.thisWeek || 0;
    } catch { /* ignore */ }

    // Load today's workout preview
    try {
      const res = await fetch(`/api/plan/${this.userId}`);
      const data = await res.json();
      const today = new Date().getDay(); // 0=Sun
      const dayIndex = today === 0 ? 6 : today - 1; // convert to 0=Mon
      const todayPlan = data.plan[dayIndex];

      const container = document.getElementById('todayWorkout');
      if (todayPlan.isRest) {
        container.innerHTML = `
          <div style="text-align:center; padding:20px; color:var(--secondary)">
            <span class="material-icons-round" style="font-size:48px">self_improvement</span>
            <p style="margin-top:8px; font-weight:600">Rest Day</p>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px">${todayPlan.tip}</p>
          </div>`;
      } else {
        container.innerHTML = todayPlan.exercises.map(ex => `
          <div class="exercise-item">
            <div>
              <div class="exercise-name">${ex.name}</div>
              <div class="exercise-detail">${ex.sets ? `${ex.sets}×${ex.reps}` : `${ex.duration} min`} · ${ex.type}</div>
            </div>
            <div class="exercise-cal">${ex.calories} cal</div>
          </div>`).join('') +
          `<div style="margin-top:12px">
            <button class="btn btn-success btn-sm btn-full" onclick="app.completeWorkout(${todayPlan.dayNumber}, ${JSON.stringify(todayPlan.exercises).replace(/"/g, '&quot;')}, ${todayPlan.totalCalories})">
              <span class="material-icons-round">check_circle</span> Complete Workout
            </button>
          </div>`;
      }
    } catch { /* ignore */ }
  },

  // ===== Complete Workout =====
  async completeWorkout(dayNumber, exercises, calories) {
    try {
      const res = await fetch('/api/workout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          dayNumber,
          exercises: exercises.map(e => e.name),
          caloriesBurned: calories
        })
      });
      const data = await res.json();
      if (data.success) {
        this.toast(`Workout complete! Streak: ${data.streak} days`, 'success');
        this.showDashboard();
      }
    } catch {
      this.toast('Failed to log workout', 'error');
    }
  },

  // ===== Plan =====
  async loadPlan() {
    if (!this.userId) return this.navigate('profile');

    try {
      const res = await fetch(`/api/plan/${this.userId}`);
      const data = await res.json();

      // Summary
      document.getElementById('planSummary').innerHTML = `
        <div class="summary-item">
          <div class="summary-value">${data.summary.workoutDays}</div>
          <div class="summary-label">Workout Days</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.summary.restDays}</div>
          <div class="summary-label">Rest Days</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.summary.totalWeeklyCalories}</div>
          <div class="summary-label">Weekly Cal</div>
        </div>`;

      // Days
      document.getElementById('planDays').innerHTML = data.plan.map(day => {
        if (day.isRest) {
          return `
            <div class="day-card">
              <div class="day-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="day-name">${day.day} <span class="day-badge rest">Rest</span></div>
                <span class="material-icons-round expand-icon">expand_more</span>
              </div>
              <div class="day-body">
                <div class="day-tip">${day.tip}</div>
              </div>
            </div>`;
        }

        return `
          <div class="day-card">
            <div class="day-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="day-name">${day.day} <span class="day-badge workout">${day.exercises.length} exercises</span></div>
              <span class="material-icons-round expand-icon">expand_more</span>
            </div>
            <div class="day-body">
              <div class="day-exercises">
                ${day.exercises.map(ex => `
                  <div class="day-exercise">
                    <div class="day-exercise-info">
                      <div class="day-exercise-name">${ex.name}</div>
                      <div class="day-exercise-detail">${ex.sets ? `${ex.sets} sets × ${ex.reps} reps` : `${ex.duration} minutes`} · ${ex.type}</div>
                    </div>
                    <div class="day-exercise-cal">${ex.calories} cal</div>
                  </div>`).join('')}
              </div>
              <div class="day-tip">${day.tip}</div>
              <div class="day-footer">
                <div class="day-totals"><span>${day.totalCalories}</span> calories · <span>${day.totalDuration}</span> min</div>
                <button class="btn btn-success btn-sm" onclick="app.completeWorkout(${day.dayNumber}, ${JSON.stringify(day.exercises).replace(/"/g, '&quot;')}, ${day.totalCalories})">
                  <span class="material-icons-round">check</span> Done
                </button>
              </div>
            </div>
          </div>`;
      }).join('');
    } catch {
      this.toast('Failed to load workout plan', 'error');
    }
  },

  // ===== Timer =====
  setTimer(seconds) {
    this.timerSeconds = seconds;
    this.timerRemaining = seconds;
    this.timerRunning = false;
    clearInterval(this.timerInterval);
    this.updateTimerDisplay();

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.onclick.toString().match(/\d+/)?.[0]) === seconds);
    });

    document.getElementById('timerStartIcon').textContent = 'play_arrow';
    document.getElementById('timerLabel').textContent = 'Ready';
  },

  toggleTimer() {
    if (this.timerRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  },

  startTimer() {
    if (this.timerRemaining <= 0) {
      this.timerRemaining = this.timerSeconds;
    }
    this.timerRunning = true;
    document.getElementById('timerStartIcon').textContent = 'pause';
    document.getElementById('timerLabel').textContent = 'Go!';

    this.timerInterval = setInterval(() => {
      this.timerRemaining--;
      this.updateTimerDisplay();

      if (this.timerRemaining <= 0) {
        this.pauseTimer();
        document.getElementById('timerLabel').textContent = 'Done!';
        this.toast('Timer complete!', 'success');
        this.timerRemaining = 0;
        this.updateTimerDisplay();
      }
    }, 1000);
  },

  pauseTimer() {
    this.timerRunning = false;
    clearInterval(this.timerInterval);
    document.getElementById('timerStartIcon').textContent = 'play_arrow';
    if (this.timerRemaining > 0) {
      document.getElementById('timerLabel').textContent = 'Paused';
    }
  },

  resetTimer() {
    this.pauseTimer();
    this.timerRemaining = this.timerSeconds;
    this.updateTimerDisplay();
    document.getElementById('timerLabel').textContent = 'Ready';
  },

  skipTimer() {
    this.pauseTimer();
    this.timerRemaining = 0;
    this.updateTimerDisplay();
    document.getElementById('timerLabel').textContent = 'Skipped';
  },

  updateTimerDisplay() {
    const mins = Math.floor(this.timerRemaining / 60);
    const secs = this.timerRemaining % 60;
    document.getElementById('timerTime').textContent =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Update ring progress
    const circumference = 2 * Math.PI * 90; // 565.48
    const progress = this.timerSeconds > 0 ? this.timerRemaining / this.timerSeconds : 0;
    const offset = circumference * (1 - progress);
    document.getElementById('timerProgress').style.strokeDashoffset = offset;
  },

  // ===== Stats =====
  async loadStats() {
    if (!this.userId) return this.navigate('profile');

    try {
      const res = await fetch(`/api/stats/${this.userId}`);
      const stats = await res.json();

      // Stats grid
      document.getElementById('statsGrid').innerHTML = `
        <div class="stat-big highlight">
          <div class="stat-big-value">${stats.streak}</div>
          <div class="stat-big-label">Day Streak</div>
        </div>
        <div class="stat-big">
          <div class="stat-big-value">${stats.totalWorkouts}</div>
          <div class="stat-big-label">Total Workouts</div>
        </div>
        <div class="stat-big">
          <div class="stat-big-value">${stats.totalCalories.toLocaleString()}</div>
          <div class="stat-big-label">Calories Burned</div>
        </div>
        <div class="stat-big">
          <div class="stat-big-value">${stats.thisWeek}</div>
          <div class="stat-big-label">This Week</div>
        </div>`;

      // Bar chart
      const weekLabels = ['8w', '7w', '6w', '5w', '4w', '3w', '2w', '1w'];
      const maxWorkouts = Math.max(1, ...stats.weeklyHistory.map(w => w.workouts));
      document.getElementById('barChart').innerHTML = stats.weeklyHistory.map((w, i) => `
        <div class="bar-col">
          <div class="bar-value">${w.workouts}</div>
          <div class="bar" style="height: ${(w.workouts / maxWorkouts) * 80 + 4}px"></div>
          <div class="bar-label">${weekLabels[i]}</div>
        </div>`).join('');

      // BMI card
      if (stats.bmi) {
        const bmiPercent = Math.min(100, Math.max(0, ((stats.bmi - 15) / 25) * 100));
        const bmiColors = { Underweight: 'var(--secondary)', Normal: 'var(--success)', Overweight: 'var(--warning)', Obese: 'var(--danger)' };
        document.getElementById('bmiCard').innerHTML = `
          <h3>Body Mass Index</h3>
          <div class="bmi-bar-container">
            <div class="bmi-marker" style="left: ${bmiPercent}%"></div>
          </div>
          <div class="bmi-labels">
            <span>Underweight</span>
            <span>Normal</span>
            <span>Overweight</span>
            <span>Obese</span>
          </div>
          <div class="bmi-value">
            <div class="bmi-number" style="color: ${bmiColors[stats.bmiCategory] || 'var(--text)'}">${stats.bmi}</div>
            <div class="bmi-category">${stats.bmiCategory}</div>
          </div>`;
      }
    } catch {
      this.toast('Failed to load stats', 'error');
    }
  },

  // ===== Toast =====
  toast(message, type = '') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast show ${type}`;
    setTimeout(() => el.classList.remove('show'), 3000);
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => app.init());
