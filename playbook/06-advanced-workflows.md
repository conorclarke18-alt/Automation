# Step 6: Advanced Automation Ideas

Once you've automated the basics, consider these higher-leverage workflows.

## Client Onboarding Automation

```
TRIGGER: New client signs contract (via DocuSign, HelloSign)

ACTIONS:
  1. Create project in project management tool
  2. Add client to CRM with "Active" status
  3. Send onboarding email sequence
  4. Create invoice in accounting software
  5. Schedule kickoff call on calendar
  6. Add client to Slack workspace (if applicable)
```

## Content Distribution Automation

```
TRIGGER: New blog post published on website (via RSS or webhook)

ACTIONS:
  1. Post link to LinkedIn with auto-generated caption
  2. Post link to Twitter as a thread
  3. Add post to email newsletter draft (in email tool)
  4. Add to content calendar (Notion or Airtable)
  5. Send notification to team (Slack) that post is live
```

## Customer Health Monitoring

```
TRIGGER: Every Monday at 9am (scheduled trigger)

ACTIONS:
  1. Pull usage data for all customers from database (via API)
  2. Flag customers with <50% of average usage
  3. Add flagged customers to "At Risk" segment in CRM
  4. Send re-engagement email campaign to at-risk customers
  5. Create task for me to personally reach out to top 10 at-risk customers
```

## Invoice and Payment Tracking

```
TRIGGER: Payment received (Stripe webhook)

ACTIONS:
  1. Mark invoice as paid in accounting software
  2. Send receipt email to customer
  3. Update CRM: customer status = "Paid"
  4. Add revenue to monthly dashboard (Google Sheets or Airtable)
  5. Send me a Slack notification: "Payment received: $X from [Customer]"
```
