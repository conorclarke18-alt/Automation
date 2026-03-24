# Pro Social Partners — Council Outreach System

A web-based dashboard for managing Local Authority outreach to win permanent adult social worker recruitment contracts.

## Features

- **Dashboard** — At-a-glance pipeline stats, follow-up reminders, and recent activity
- **Council Database** — Track every target Local Authority with contacts, status, and interaction history
- **Outreach Templates** — Proven email and LinkedIn templates for HR teams, Directors, and Heads of Service
- **Follow-up Tracker** — Never miss a follow-up with overdue alerts and scheduling
- **Pipeline View** — Visual kanban board showing councils at each stage from first contact to active client

## Quick Start

```bash
cd council-outreach-app
npm install
npm start
```

Open http://localhost:3000

## How It Works

1. **Add councils** from the Council Database page (UK councils pre-loaded in regions data)
2. **Add contacts** — the HR managers, directors, and heads of service you need to reach
3. **Use templates** — copy proven outreach emails and personalise them
4. **Log interactions** — every email, call, LinkedIn message, and meeting
5. **Track follow-ups** — the system calculates when to follow up based on your outreach sequence
6. **Monitor your pipeline** — see conversion rates from contacted through to active client

## Outreach Sequence

The built-in templates follow a proven 4-touch sequence:

1. **Day 0** — Initial approach (tailored to HR, Director, or Head of Service)
2. **Day 3** — Value-add follow-up (share market insight / salary data)
3. **Day 7** — Soft check-in (offer to be redirected to right person)
4. **Day 14** — Strong candidate available (only if you have a genuine match)
5. **Day 30** — Final touch / re-queue for 3 months

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JavaScript (no frameworks)
- **Storage:** JSON file-based (no database required)
