# Step 5: Monitor and Maintain Automations

Automations aren't set-it-and-forget-it. They break. Tools change. APIs update.

## Weekly Check (5 min)

- Scan workflow logs for errors (most tools show a log of runs + failures)
- Address any failures immediately

## Monthly Audit (15 min)

- Review all active workflows
- Check: Is this still being used? Is it still saving time?
- Disable or delete unused workflows
- Update any workflows that depend on tools you've switched away from

## Documentation

Create a simple doc for each workflow (use `templates/workflow-template.md`). Include:
- What it does
- When it runs
- What apps it connects
- How to troubleshoot

If you have 10+ workflows, this documentation will save you hours when something breaks.

## Error Handling Setup

- Route all error notifications to one place (Slack channel, email inbox, or task manager)
- Set up: "If any workflow fails, send a message to [your error channel]"
- Review errors weekly and fix root causes
