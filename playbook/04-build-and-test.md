# Step 4: Build and Test Your Workflow

Now implement it in your chosen tool.

## Build Workflow (Zapier Example)

1. **Choose trigger app** (e.g., Google Forms, Typeform, website form)
2. **Connect your account** (authenticate via OAuth)
3. **Test trigger** (submit a test form to make sure data comes through)
4. **Add action** (e.g., "Add row to Google Sheets")
5. **Map fields** (match form fields to spreadsheet columns)
6. **Test action** (run test to verify row is added correctly)
7. **Repeat for additional actions**
8. **Turn on workflow** (Zapier calls this "turn on Zap")

## Testing Checklist

- [ ] Submit test data through the trigger
- [ ] Verify each action executes correctly
- [ ] Check that data maps to the right fields
- [ ] Test with edge cases (empty fields, special characters, long text)
- [ ] Test error handling (intentionally cause a failure to see if alerts work)

## Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Workflow doesn't trigger | Trigger conditions too narrow | Check filter settings, broaden criteria |
| Action fails | API rate limit or permissions | Add delay between actions, re-authenticate |
| Data missing or incorrect | Field mapping wrong | Double-check which fields are mapped |
| Workflow runs multiple times | Duplicate triggers | De-duplicate based on unique ID |

## Rule

Test with real data before relying on an automation. Don't discover bugs when a real customer is involved.
