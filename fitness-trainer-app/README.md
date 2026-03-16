# FitCoach - Virtual Personal Fitness Trainer

A web application that acts as your virtual personal trainer. Enter your weight, height, and fitness goals to get a fully personalized weekly workout plan, daily reminders, and motivational quotes to keep you going.

## Features

- **Personalized Fitness Plans** - Get a custom 7-day workout plan based on your body metrics (weight, height, BMI), fitness goals, and experience level
- **4 Fitness Goals** - Lose Weight, Build Muscle, Improve Endurance, or Stay Fit & Healthy
- **3 Difficulty Levels** - Beginner, Intermediate, and Advanced workouts
- **BMI Calculator** - Automatic BMI calculation with health category assessment
- **Daily Reminders & Alerts** - Workout reminders, hydration checks, nutrition tips, and sleep alerts throughout the day
- **Browser Notifications** - Native push notifications for workout times, hydration, and sleep reminders
- **Motivational Quotes** - Fresh daily motivational quote to keep you inspired
- **Progress Tracking** - Track completed workouts, calories burned, and workout streaks
- **Coach Tips** - Personalized recommendations based on your profile and goals

## Quick Start

```bash
cd fitness-trainer-app
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **Set Up Profile** - Enter your name, age, weight, height, gender, fitness goal, and level
2. **Get Your Plan** - A personalized 7-day workout plan is generated with exercises, sets/reps, and calorie estimates
3. **Follow Reminders** - Daily alerts keep you on track with workouts, hydration, nutrition, and sleep
4. **Track Progress** - Mark workouts as complete, build streaks, and monitor your stats

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Storage**: JSON file-based (no database needed)
- **Notifications**: Browser Notification API
- **Scheduling**: node-cron for server-side scheduling
