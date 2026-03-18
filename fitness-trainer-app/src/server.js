const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Data helpers ---

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- Profile ---

app.post('/api/profile', (req, res) => {
  const { name, age, weight, weightUnit, height, heightUnit, gender, goal, level, reminderTime } = req.body;

  if (!name || !age || !weight || !height || !goal || !level) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const weightKg = weightUnit === 'lbs' ? weight * 0.453592 : weight;
  const heightCm = heightUnit === 'inches' ? height * 2.54 : height;
  const heightM = heightCm / 100;
  const bmi = +(weightKg / (heightM * heightM)).toFixed(1);

  let bmiCategory = 'Normal';
  if (bmi < 18.5) bmiCategory = 'Underweight';
  else if (bmi >= 25 && bmi < 30) bmiCategory = 'Overweight';
  else if (bmi >= 30) bmiCategory = 'Obese';

  const users = loadUsers();
  const existingId = req.body.userId;
  const userId = existingId && users[existingId] ? existingId : uuidv4();

  users[userId] = {
    ...users[userId],
    userId, name, age: +age, weight: +weight, weightUnit: weightUnit || 'kg',
    height: +height, heightUnit: heightUnit || 'cm', gender: gender || 'other',
    goal, level, reminderTime: reminderTime || '08:00',
    bmi, bmiCategory,
    completedWorkouts: users[userId]?.completedWorkouts || [],
    createdAt: users[userId]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  saveUsers(users);
  res.json({ userId, profile: users[userId] });
});

app.get('/api/profile/:id', (req, res) => {
  const users = loadUsers();
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// --- Workout Plan ---

app.get('/api/plan/:userId', (req, res) => {
  const users = loadUsers();
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const exercises = loadJSON('exercises.json');
  const pool = exercises[user.goal]?.[user.level] || exercises.stay_fit.beginner;

  const restDays = user.level === 'beginner' ? [3, 7] : user.level === 'intermediate' ? [4] : [7];
  const exercisesPerDay = user.level === 'advanced' ? 5 : 4;
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const tips = {
    lose_weight: [
      'Keep your heart rate in the fat-burning zone (60-70% max HR)',
      'Pair today\'s workout with a calorie deficit for best results',
      'HIIT burns calories even after your workout ends',
      'Focus on compound movements to maximize calorie burn',
      'Stay hydrated — water boosts metabolism by up to 30%',
      'Active recovery is key — try a light walk today',
      'Consistency beats intensity. Keep showing up!'
    ],
    build_muscle: [
      'Progressive overload: aim to increase weight or reps each week',
      'Eat 1.6-2.2g protein per kg of bodyweight for optimal gains',
      'Compound lifts build the most muscle — prioritize them',
      'Mind-muscle connection: focus on the squeeze',
      'Sleep 7-9 hours — muscles grow during recovery',
      'Use controlled negatives to maximize time under tension',
      'Deload weeks every 4-6 weeks prevent overtraining'
    ],
    improve_endurance: [
      'Build your aerobic base with steady-state cardio',
      'Breathing rhythm: inhale for 3 steps, exhale for 2',
      'Cross-training prevents overuse injuries',
      'Gradually increase duration by 10% per week max',
      'Fuel with complex carbs 2-3 hours before training',
      'Recovery runs should feel conversational pace',
      'Track your resting heart rate — lower means fitter'
    ],
    stay_fit: [
      'Variety keeps your body guessing and adapting',
      'Balance strength, cardio, and flexibility each week',
      'Listen to your body — adjust intensity as needed',
      'Functional movements improve daily life quality',
      'Stretching after workouts prevents tightness',
      'Aim for 150+ minutes of moderate activity per week',
      'Enjoy the process — fitness is a lifestyle, not a race'
    ]
  };

  const plan = dayNames.map((day, i) => {
    const dayNum = i + 1;
    if (restDays.includes(dayNum)) {
      return { day, dayNumber: dayNum, isRest: true, tip: 'Rest and recover. Light stretching or a walk is great for active recovery.' };
    }

    const startIdx = (i * exercisesPerDay) % pool.length;
    const dayExercises = [];
    for (let j = 0; j < exercisesPerDay; j++) {
      dayExercises.push({ ...pool[(startIdx + j) % pool.length] });
    }

    const totalCalories = dayExercises.reduce((sum, ex) => sum + (ex.calories || 0), 0);
    const totalDuration = dayExercises.reduce((sum, ex) => sum + (ex.duration || 5), 0);

    return {
      day, dayNumber: dayNum, isRest: false,
      exercises: dayExercises,
      totalCalories, totalDuration,
      tip: tips[user.goal]?.[i] || tips.stay_fit[i]
    };
  });

  const workoutDays = plan.filter(d => !d.isRest);
  const totalWeeklyCalories = workoutDays.reduce((sum, d) => sum + d.totalCalories, 0);

  res.json({
    plan,
    summary: {
      workoutDays: workoutDays.length,
      restDays: restDays.length,
      totalWeeklyCalories,
      goal: user.goal,
      level: user.level
    }
  });
});

// --- Complete Workout ---

app.post('/api/workout/complete', (req, res) => {
  const { userId, dayNumber, exercises, caloriesBurned } = req.body;
  const users = loadUsers();
  const user = users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const entry = {
    date: new Date().toISOString(),
    dayNumber,
    exercises: exercises || [],
    caloriesBurned: caloriesBurned || 0
  };

  user.completedWorkouts.push(entry);

  // Calculate streak
  const dates = user.completedWorkouts
    .map(w => new Date(w.date).toDateString())
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort((a, b) => new Date(b) - new Date(a));

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i - 1]) - new Date(dates[i])) / (1000 * 60 * 60 * 24);
    if (diff <= 2) streak++;
    else break;
  }

  user.streak = streak;
  saveUsers(users);

  res.json({ success: true, streak, totalWorkouts: user.completedWorkouts.length });
});

// --- Stats ---

app.get('/api/stats/:userId', (req, res) => {
  const users = loadUsers();
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const completed = user.completedWorkouts || [];
  const totalCalories = completed.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = completed.filter(w => new Date(w.date) >= weekStart).length;

  // Weekly history (last 8 weeks)
  const weeklyHistory = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - i * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const count = completed.filter(w => {
      const d = new Date(w.date);
      return d >= start && d < end;
    }).length;
    const cal = completed.filter(w => {
      const d = new Date(w.date);
      return d >= start && d < end;
    }).reduce((s, w) => s + (w.caloriesBurned || 0), 0);
    weeklyHistory.push({ weekStart: start.toISOString(), workouts: count, calories: cal });
  }

  res.json({
    totalWorkouts: completed.length,
    totalCalories,
    streak: user.streak || 0,
    thisWeek,
    bmi: user.bmi,
    bmiCategory: user.bmiCategory,
    memberSince: user.createdAt,
    weeklyHistory,
    goal: user.goal,
    level: user.level
  });
});

// --- Reminders ---

app.get('/api/reminders/:userId', (req, res) => {
  const users = loadUsers();
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const quotes = loadJSON('quotes.json');
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  const nutritionTips = {
    lose_weight: 'Focus on high-protein, low-calorie meals. Fill half your plate with vegetables.',
    build_muscle: 'Eat a protein-rich meal within 30 minutes of your workout for recovery.',
    improve_endurance: 'Complex carbs are your fuel. Eat oats, sweet potatoes, or brown rice.',
    stay_fit: 'Eat a balanced meal with protein, healthy fats, and complex carbs.'
  };

  res.json([
    { type: 'motivation', time: '07:00', icon: 'sparkles', title: 'Daily Motivation', message: `"${quote.text}" — ${quote.author}` },
    { type: 'workout', time: user.reminderTime || '08:00', icon: 'fitness_center', title: 'Workout Time!', message: `Time to crush your ${user.goal.replace('_', ' ')} workout, ${user.name}!` },
    { type: 'hydration', time: '10:00', icon: 'water_drop', title: 'Stay Hydrated', message: 'Drink a full glass of water. Aim for 8 glasses today!' },
    { type: 'nutrition', time: '12:00', icon: 'restaurant', title: 'Nutrition Check', message: nutritionTips[user.goal] || nutritionTips.stay_fit },
    { type: 'sleep', time: '21:00', icon: 'bedtime', title: 'Wind Down', message: 'Start your bedtime routine. Quality sleep = better gains!' }
  ]);
});

// --- Quote ---

app.get('/api/quote', (_req, res) => {
  const quotes = loadJSON('quotes.json');
  res.json(quotes[Math.floor(Math.random() * quotes.length)]);
});

// --- SPA fallback ---

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FitCoach Pro running at http://localhost:${PORT}`);
});
