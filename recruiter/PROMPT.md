# Standing prompt — working a role in a cloud session

Paste one of these into a new Claude Code session on the `Automation` repo.

---

## Short version (use this once PR #3 is merged)

Merging puts the `psp-recruiter` skill on the default branch, so it loads
automatically and the prompt can stay this short.

```
Work this role as my recruiter:

CLIENT:    Medway Council
ROLE:      Social Worker, Children with Disabilities
POSTCODE:  ME4
GRADE:     QSW
SALARY:    £39,823-£43,435 base
PACKAGE:   £50,435 (£5,000 market supplement + £2,000 retention)
TEAM:      Children with Disabilities
CLOSES:    23 August
SPONSORS:  no

Use the psp-recruiter skill. Give me the ranked list first with reasons —
do not create any drafts until I approve the list.
```

Swap the block for whatever role you are working. Anything you leave out,
Claude should ask about only if it changes the shortlist.

---

## Full version (works in any session, skill or no skill)

Longer, but self-contained — paste it if the skill has not loaded, or into a
session on a different repo.

```
Act as my recruiter at Pro Social Partners. I place permanent social workers
into local authorities, children's trusts and IFAs.

THE ROLE
  Client:   Medway Council
  Role:     Social Worker, Children with Disabilities
  Postcode: ME4 (Chatham, Kent)
  Grade:    QSW
  Salary:   £39,823-£43,435 base
  Package:  £50,435 including a £5,000 market supplement and £2,000 retention
  Team:     Children with Disabilities
  Closes:   23 August
  Sponsors visas: no

GO THROUGH ALL FOUR SOURCES — do not stop at the first one:

1. Conor Submission Spreadsheet.xlsx (Documents/Conors Spreadsheet/, 44 client
   tabs). Everyone submitted to this specialism anywhere, AND frontline
   safeguarding/assessment people — they will consider a move across.
2. The Jobs Tracker Interviews and Deals tabs. Who has interviewed for this
   specialism, and who is already placed (exclude them).
3. The CV folders — Documents/Candidate CVs/ (about 1,000 formatted CVs).
   Search the CV text for the specialism, not just job titles.
4. My Outlook inbox. Search for the specialism and read INBOUND replies:
   people who have said in writing that they want this kind of work. This
   source outranks the spreadsheets — someone filed under a far-away postcode
   who emailed last week asking for this specialism is a hot lead, not a
   commuting problem.

ALSO CHECK these files, which carry contact details the master list slice
does not: "Swindon - Candidate Shortlist.xlsx" and "Haringey CP Advisor -
Shortlist.xlsx", both in Documents/CLAUDE CODE/psp-pipeline-tracker/.

RANK THEM on specialism fit, grade, commute and our history with this client.
Drop the commute weighting for anyone relocating or needing sponsorship the
client can offer. Give me 30+ candidates in tiers, not a top 5.

FOR EACH ONE tell me: what we submitted them for at this client and what
happened, their experience and where the evidence comes from (CV, past
submissions, or just their master-list job title — say which), and where
they live.

RULES THAT BEAT THE RANKING
  - Never cross-submit anyone in a live process. Check first.
  - Never approach someone already placed at this client.
  - Do not re-run anyone into the same team that rejected them; a different
    team at the same client is fine.
  - Flag anyone who applied direct or via another agency — ownership.
  - If they need sponsorship and the client cannot sponsor, exclude them.

THEN produce, as a Word document with clickable links:
  - a WhatsApp link per candidate (web.whatsapp.com/send, not wa.me) with a
    pre-written message that is DIFFERENT for each person and SELLS the role —
    package first. Keep the distance vague to the candidate ("not too far from
    you"), precise in my briefing.
  - a mailto: link per candidate that opens Outlook with the email composed.
    Send them the candidate-safe reasons only — never my internal notes about
    other clients' rejections.

LIST THE CANDIDATES FIRST. Do not write anything into my Outlook drafts until
I have approved the list.
```

---

## What to expect back

A tiered shortlist in chat, then a `.docx` and `.html` campaign sheet with
live links. Nothing is sent and no drafts are created until you say so.

## Known limits in a cloud session

- The Microsoft 365 connector truncates large sheets, so it only renders the
  first slice of `MAIN CANDIDATE LIST.xlsx` and about 6 of the 44 submission
  tabs. Claude should say so rather than present a partial list as complete.
- `outlook_create_draft` returns 403 until `Mail.ReadWrite` is consented on
  the app registration. The `mailto:` links are the workaround.
- Files on your laptop are not reachable. Run `scan_cvs.py` there and upload
  `cv_index.csv`.
