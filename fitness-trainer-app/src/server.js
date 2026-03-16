const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Data paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
const EXERCISES_FILE = path.join(DATA_DIR, 'exercises.json');

// Helper: read/write JSON
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Load static data
const quotes = readJSON(QUOTES_FILE);
const exercises = readJSON(EXERCISES_FILE);

// ─── API Routes ──────────────────────────────────────────────

// Get a random motivational quote
app.get('/api/quote', (req, res) => {
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  res.json(quote);
});

// Create or update user profile
app.post('/api/profile', (req, res) => {
  const { name, age, weight, height, weightUnit, heightUnit, gender, goal, fitnessLevel, reminderTime } = req.body;

  if (!name || !weight || !height || !goal || !fitnessLevel) {
    return res.status(400).json({ error: 'Missing required fields: name, weight, height, goal, fitnessLevel' });
  }

  const users = readJSON(USERS_FILE);

  // Calculate BMI (convert to metric if needed)
  let weightKg = parseFloat(weight);
  let heightCm = parseFloat(height);

  if (weightUnit === 'lbs') weightKg = weightKg * 0.453592;
  if (heightUnit === 'inches') heightCm = heightCm * 2.54;

  const heightM = heightCm / 100;
  const bmi = (weightKg / (heightM * heightM)).toFixed(1);

  let bmiCategory;
  if (bmi < 18.5) bmiCategory = 'Underweight';
  else if (bmi < 25) bmiCategory = 'Normal';
  else if (bmi < 30) bmiCategory = 'Overweight';
  else bmiCategory = 'Obese';

  // Check for existing user by name
  const existingIndex = users.findIndex(u => u.name.toLowerCase() === name.toLowerCase());

  const user = {
    id: existingIndex >= 0 ? users[existingIndex].id : uuidv4(),
    name,
    age: parseInt(age) || null,
    weight: parseFloat(weight),
    weightUnit: weightUnit || 'kg',
    height: parseFloat(height),
    heightUnit: heightUnit || 'cm',
    gender: gender || 'other',
    goal,
    fitnessLevel,
    bmi: parseFloat(bmi),
    bmiCategory,
    reminderTime: reminderTime || '08:00',
    createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedWorkouts: existingIndex >= 0 ? users[existingIndex].completedWorkouts : [],
    streak: existingIndex >= 0 ? users[existingIndex].streak : 0
  };

  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }

  writeJSON(USERS_FILE, users);
  res.json(user);
});

// Get user profile
app.get('/api/profile/:id', (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Generate a fitness plan for the user
app.get('/api/plan/:userId', (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const goalExercises = exercises[user.goal];
  if (!goalExercises) return res.status(400).json({ error: 'Invalid goal' });

  const levelExercises = goalExercises[user.fitnessLevel];
  if (!levelExercises) return res.status(400).json({ error: 'Invalid fitness level' });

  // Build a 7-day plan
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const restDays = user.fitnessLevel === 'beginner' ? [3, 6] :
                   user.fitnessLevel === 'intermediate' ? [3] : [6];

  const weeklyPlan = days.map((day, index) => {
    if (restDays.includes(index)) {
      return { day, isRestDay: true, exercises: [], tip: 'Rest and recover. Stay hydrated and get good sleep!' };
    }

    // Pick 4-5 exercises for the day, rotating through the list
    const count = user.fitnessLevel === 'advanced' ? 5 : 4;
    const dayExercises = [];
    for (let i = 0; i < count; i++) {
      dayExercises.push(levelExercises[(index * count + i) % levelExercises.length]);
    }

    const totalCalories = dayExercises.reduce((sum, ex) => sum + (ex.calories || 0), 0);

    return {
      day,
      isRestDay: false,
      exercises: dayExercises,
      estimatedCalories: totalCalories,
      tip: getDayTip(index, user.goal)
    };
  });

  // Calculate weekly summary
  const totalWeeklyCalories = weeklyPlan.reduce((sum, d) => sum + (d.estimatedCalories || 0), 0);
  const workoutDays = weeklyPlan.filter(d => !d.isRestDay).length;

  const plan = {
    userId: user.id,
    userName: user.name,
    goal: formatGoal(user.goal),
    fitnessLevel: user.fitnessLevel,
    bmi: user.bmi,
    bmiCategory: user.bmiCategory,
    weeklyPlan,
    summary: {
      workoutDaysPerWeek: workoutDays,
      restDaysPerWeek: 7 - workoutDays,
      estimatedWeeklyCaloriesBurned: totalWeeklyCalories,
      recommendation: getRecommendation(user)
    },
    generatedAt: new Date().toISOString()
  };

  res.json(plan);
});

// Log a completed workout
app.post('/api/workout/complete', (req, res) => {
  const { userId, day, exercises: completedExercises } = req.body;
  const users = readJSON(USERS_FILE);
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex < 0) return res.status(404).json({ error: 'User not found' });

  const today = new Date().toISOString().split('T')[0];
  const workout = {
    date: today,
    day,
    exercises: completedExercises || [],
    completedAt: new Date().toISOString()
  };

  users[userIndex].completedWorkouts.push(workout);

  // Update streak
  const workouts = users[userIndex].completedWorkouts;
  if (workouts.length >= 2) {
    const lastDate = new Date(workouts[workouts.length - 2].date);
    const thisDate = new Date(today);
    const diffDays = Math.floor((thisDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays <= 2) {
      users[userIndex].streak += 1;
    } else {
      users[userIndex].streak = 1;
    }
  } else {
    users[userIndex].streak = 1;
  }

  writeJSON(USERS_FILE, users);
  res.json({
    message: 'Workout logged!',
    streak: users[userIndex].streak,
    totalWorkouts: users[userIndex].completedWorkouts.length
  });
});

// Get user stats
app.get('/api/stats/:userId', (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const totalWorkouts = user.completedWorkouts.length;
  const totalCalories = user.completedWorkouts.reduce((sum, w) => {
    return sum + (w.exercises || []).reduce((s, e) => s + (e.calories || 0), 0);
  }, 0);

  // Workouts this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeekWorkouts = user.completedWorkouts.filter(w => new Date(w.date) >= weekStart).length;

  res.json({
    totalWorkouts,
    totalCaloriesBurned: totalCalories,
    currentStreak: user.streak,
    thisWeekWorkouts,
    bmi: user.bmi,
    bmiCategory: user.bmiCategory,
    memberSince: user.createdAt
  });
});

// Get today's reminders
app.get('/api/reminders/:userId', (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const today = new Date();
  const dayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1; // Monday = 0
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const todayName = days[dayIndex];

  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  const reminders = [
    {
      type: 'workout',
      time: user.reminderTime,
      message: `Time for your ${todayName} workout! Let's crush it, ${user.name}!`,
      day: todayName
    },
    {
      type: 'hydration',
      time: '10:00',
      message: 'Stay hydrated! Aim for at least 8 glasses of water today.'
    },
    {
      type: 'motivation',
      time: '07:00',
      message: `"${quote.text}" - ${quote.author}`
    },
    {
      type: 'nutrition',
      time: '12:00',
      message: getNutritionTip(user.goal)
    },
    {
      type: 'sleep',
      time: '21:00',
      message: 'Wind down and aim for 7-9 hours of sleep. Recovery is key!'
    }
  ];

  res.json({ today: todayName, reminders, quote });
});

// ─── Helper Functions ────────────────────────────────────────

function formatGoal(goal) {
  const map = {
    lose_weight: 'Lose Weight',
    build_muscle: 'Build Muscle',
    improve_endurance: 'Improve Endurance',
    stay_fit: 'Stay Fit & Healthy'
  };
  return map[goal] || goal;
}

function getDayTip(dayIndex, goal) {
  const tips = {
    lose_weight: [
      'Focus on keeping your heart rate elevated during cardio segments.',
      'Keep rest periods short (30-45 seconds) to maximize calorie burn.',
      'Pair your workout with a calorie-deficit diet for best results.',
      'Rest day - go for a light walk to stay active.',
      'Try to increase intensity slightly from last week.',
      'Finish strong! Weekend workouts set the tone for next week.',
      'Rest day - meal prep healthy food for the week ahead.'
    ],
    build_muscle: [
      'Focus on proper form over heavy weight.',
      'Increase weight slightly when exercises feel too easy.',
      'Eat protein within 30 minutes of finishing your workout.',
      'Rest day - stretch and foam roll to aid recovery.',
      'Focus on the mind-muscle connection today.',
      'Progressive overload is key - track your weights!',
      'Rest day - prioritize sleep for muscle recovery.'
    ],
    improve_endurance: [
      'Start at a comfortable pace and gradually increase.',
      'Focus on your breathing rhythm today.',
      'Hydrate well before, during, and after your workout.',
      'Rest day - light stretching and mobility work.',
      'Push your limits a little further today.',
      'Cross-training day - try a different cardio exercise.',
      'Rest day - recovery is part of training.'
    ],
    stay_fit: [
      'Enjoy your workout - consistency beats intensity.',
      'Mix it up to keep things interesting.',
      'Listen to your body and adjust intensity as needed.',
      'Rest day - take a walk in nature.',
      'Focus on flexibility and mobility today.',
      'Try something new or invite a friend to join.',
      'Rest day - reflect on your progress this week.'
    ]
  };
  return (tips[goal] || tips.stay_fit)[dayIndex];
}

function getNutritionTip(goal) {
  const tips = {
    lose_weight: 'Focus on lean proteins and vegetables. Aim for a slight calorie deficit of 300-500 calories.',
    build_muscle: 'Eat 1.6-2.2g of protein per kg of bodyweight. Prioritize whole foods and complex carbs.',
    improve_endurance: 'Fuel up with complex carbohydrates before workouts. Keep electrolytes balanced.',
    stay_fit: 'Eat a balanced diet with plenty of fruits, vegetables, lean proteins, and whole grains.'
  };
  return tips[goal] || tips.stay_fit;
}

function getRecommendation(user) {
  const recs = [];

  if (user.bmi > 30) {
    recs.push('Consider consulting a healthcare provider before starting an intense exercise program.');
  }
  if (user.goal === 'lose_weight') {
    recs.push('Combine this workout plan with a balanced, calorie-controlled diet for best results.');
    recs.push('Aim to burn 300-500 more calories than you consume daily.');
  }
  if (user.goal === 'build_muscle') {
    recs.push('Ensure adequate protein intake (1.6-2.2g per kg of bodyweight).');
    recs.push('Get 7-9 hours of sleep for optimal muscle recovery.');
  }
  if (user.goal === 'improve_endurance') {
    recs.push('Gradually increase duration and intensity over weeks.');
    recs.push('Stay well-hydrated and monitor your heart rate during workouts.');
  }
  recs.push('Warm up for 5-10 minutes before each workout and cool down after.');
  recs.push('Listen to your body and rest if you feel pain or extreme fatigue.');

  return recs;
}

// ─── Serve Frontend ──────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Fitness Trainer App running at http://localhost:${PORT}\n`);
});
