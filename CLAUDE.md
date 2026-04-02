# CLAUDE.md

## Repository Overview

This repository is a comprehensive automation resource for solopreneurs, containing:

1. **fitness-trainer-app/** - A Node.js/Express web application (FitCoach) for personalized workout plans
2. **playbook/** - A 7-step Markdown guide on identifying, building, and maintaining automation workflows
3. **templates/** - Ready-to-use Markdown/CSV templates for workflow documentation and auditing
4. **tools/** - An interactive HTML ROI calculator for evaluating automation investments

## Tech Stack

- **Backend**: Node.js, Express 4.18.2, node-cron 3.0.3, uuid 9.0.0
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (no framework)
- **Data**: JSON file-based storage (no database)
- **Documentation**: Markdown, CSV

## Project Structure

```
Automation/
├── README.md
├── fitness-trainer-app/
│   ├── package.json
│   ├── src/server.js          # Express API server (all routes + logic)
│   ├── public/
│   │   ├── index.html         # SPA shell
│   │   ├── css/style.css      # Full styling with CSS variables
│   │   └── js/app.js          # Client-side SPA logic
│   └── data/
│       ├── exercises.json     # Exercise database (by goal + level)
│       └── quotes.json        # 30 motivational quotes
├── playbook/
│   ├── 01-identify-opportunities.md
│   ├── 02-choose-tools.md
│   ├── 03-design-workflows.md
│   ├── 04-build-and-test.md
│   ├── 05-monitor-and-maintain.md
│   ├── 06-advanced-workflows.md
│   └── 07-mistakes-to-avoid.md
├── templates/
│   ├── workflow-template.md
│   ├── maintenance-checklist.md
│   └── automation-audit.csv
└── tools/
    └── roi-calculator.html
```

## Development Commands

```bash
# Install dependencies (from fitness-trainer-app/)
cd fitness-trainer-app && npm install

# Start the server
npm start            # node src/server.js

# Start with file watching (dev mode)
npm run dev          # node --watch src/server.js
```

The server runs on the port defined in `server.js`. No environment variables or `.env` file is required.

## Architecture & Key Patterns

### Backend (fitness-trainer-app/src/server.js)

- **Single-file Express server** with all routes and helpers in one file
- **RESTful API endpoints**:
  - `POST /api/profile` - Create/update user profile (calculates BMI)
  - `GET /api/plan/:userId` - Generate 7-day workout plan based on user goal/level
  - `GET /api/quote` - Random motivational quote
  - `GET /api/stats/:userId` - User statistics (streaks, calories, workouts)
  - `GET /api/reminders/:userId` - Daily reminder schedule
  - `POST /api/workout/complete` - Mark workout as done, update streak
- **JSON file I/O** via `readJSON()` / `writeJSON()` helpers
- **No database** - user data stored in `data/users.json` (gitignored)
- **Units**: Imperial input (lbs, inches) converted to metric for BMI calculation
- **Streak logic**: Allows up to 2-day gaps while maintaining streak continuity

### Frontend (fitness-trainer-app/public/js/app.js)

- **Single-page application** with 5 pages: home, profile, plan, reminders, stats
- **Navigation**: Page switching via `showPage()` with DOM class toggling
- **State**: Global variables (`currentUser`, `currentPlan`), persisted user ID in `localStorage`
- **All fetch calls use async/await**
- **Browser Notification API** for workout reminders

### CSS Conventions (fitness-trainer-app/public/css/style.css)

- CSS custom properties at `:root` for colors, shadows, radius, transitions
- Color palette: purple `#6c5ce7`, cyan `#00cec9`, pink `#fd79a8`, green `#00b894`
- Mobile-first with bottom navigation bar
- Flexbox and CSS Grid for responsive layouts

### Data Files

- `exercises.json`: Nested structure - goal (lose_weight, build_muscle, improve_endurance, stay_fit) -> level (beginner, intermediate, advanced) -> array of exercises with name, duration, calories
- `quotes.json`: Array of 30 objects with `text` and `author` fields

## Conventions to Follow

- **No test framework** is configured; there are no automated tests
- **No linter or formatter** is configured
- **No CI/CD pipeline** exists
- **CommonJS modules** (`require`/`module.exports`), not ESM
- **Vanilla JS only** on the frontend - do not introduce frameworks
- **File-based JSON storage** - do not introduce a database dependency
- The server is a **single-file architecture** (`server.js`); keep it that way unless it grows significantly
- Code comments use `// ─── Section Name ───` dividers for major sections in server.js
- Playbook files follow numbered naming: `NN-topic-name.md`
- Keep `data/users.json` in `.gitignore` (contains user data)

## Content Guidelines

- Playbook content targets **solopreneurs** with varying technical skill levels
- Templates are designed to be **immediately usable** without modification
- The ROI calculator (`tools/roi-calculator.html`) is a self-contained HTML file with inline CSS/JS
