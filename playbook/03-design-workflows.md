# Step 3: Design Your Workflow

Before building, map out the workflow on paper or a whiteboard.

## Workflow Design Template

```
TRIGGER: What event starts the workflow?
  Example: "New row added to Google Sheet"

CONDITIONS (optional): Should this run every time, or only when certain conditions are met?
  Example: "Only if Status column = 'Approved'"

ACTIONS: What should happen as a result?
  Step 1: [action]
  Step 2: [action]
  Step 3: [action]

ERROR HANDLING: What happens if something fails?
  Example: "Send me a Slack message if action fails"
```

## Example: Lead Capture -> CRM -> Email

```
TRIGGER: New form submission on website

CONDITIONS: Email field is not empty

ACTIONS:
  Step 1: Add lead to CRM (e.g., Airtable or HubSpot)
  Step 2: Send welcome email via email tool (e.g., ConvertKit)
  Step 3: Create task in project management tool (e.g., Notion) to follow up in 3 days
  Step 4: Send me a Slack notification: "New lead: [Name]"

ERROR HANDLING: If Step 1 fails, send email alert to me
```

## Design Principles

1. **Keep it simple** - Start with 2-3 steps, add complexity later
2. **Test each step individually** before chaining them together
3. **Add delays between actions** if needed (some APIs are slow)
4. **Always include error notifications** so you know when things break

Use `templates/workflow-template.md` for a ready-to-fill version of this template.
