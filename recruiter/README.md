# PSP Recruiter

Give it a live social work vacancy; it gives back a ranked shortlist with real
reasoning, pre-filled WhatsApp links and Outlook email drafts.

It answers the question Conor actually asks: *who have we got for this, and why
them?* — grounded in where candidates have been submitted before, what their CV
says, and where they live.

## Install

```bash
pip install openpyxl
```

## 1. Build the index

Run this where the real spreadsheets are (the OneDrive folder, not a copy):

```bash
python3 psp/index.py --db data/psp.db \
  --master "MAIN CANDIDATE LIST.xlsx" \
  --subs   "Conor Submission Spreadsheet.xlsx" \
  --cvs    "Candidate CVs"
```

| Source | Rows | Contributes |
|---|---|---|
| `MAIN CANDIDATE LIST.xlsx` | 12 regional tabs | contact, postcode, sector, current position |
| `Conor Submission Spreadsheet.xlsx` | 44 client tabs | full submission history and outcomes |
| `Candidate CVs/` | ~1,000 `.docx` | specialism evidence, the most reliable signal |

Re-run it whenever the spreadsheets change. Submissions are replaced on each
build; candidates and CVs are upserted.

**Without local files:** `psp/textdump.py` ingests the Microsoft 365 connector's
text rendering of the same workbooks. The connector truncates large sheets, so
this sees only the first slice of the master list — usable for testing, not for
a real shortlist.

## 2. Shortlist a role

```bash
python3 find_candidates.py \
  --client "Medway" \
  --title  "Senior Practitioner CP" \
  --postcode ME4 \
  --salary-from 58000 --salary-to 61920 \
  --perks "£5k golden hello,hybrid working" \
  --team "Safeguarding" \
  --sponsors \
  --limit 12 \
  --json-out medway_sp.json
```

Markdown briefing goes to stdout. The JSON sidecar carries the WhatsApp links
and email drafts, so reviewing and sending stay separate steps. **Nothing is
sent by this tool.**

## How candidates are scored

Out of 100, from four axes:

| Axis | Anchored | Will relocate |
|---|---:|---:|
| Specialism fit | 30 | 38 |
| Grade fit | 20 | 26 |
| Commute | 25 | 6 |
| Client history | 25 | 30 |

Distance stops being the question for anyone who is actively relocating or who
needs sponsorship the client can provide — those candidates are judged on what
they can do. A sponsorship match also scores a bonus: few employers can help
them, so they convert well.

**Specialism** comes from the CV first, then past submission job titles, then
the master-list position. The output always names which, because they are not
equally trustworthy. Adjacent specialisms score partial credit — a CIC worker is
a credible LAC applicant.

**Grade** is a seven-rung ladder (NQSW → SW → ESW → Senior/SP/AP → ATM/DTM → TM
→ SM/HOS) plus a separate reviewing track (IRO, CP Chair, Panel Advisor, LADO).
One step up scores well; a step down is flagged rather than hidden.

**History** reads the free-text outcome column — two years of "Interview but
didn't go", "another agency", "IDIOT" — and reduces it to a comparable state. A
prior offer is the strongest warm signal there is.

## Hard exclusions

Applied before scoring, because these cost money or a client:

- Needs sponsorship, client cannot sponsor
- Wrong sector (adults vs children's), unless their record says they want to cross
- Beyond `--max-miles` **and** not willing to relocate

## Flags you must read

The score ranks; the flags decide. Each one is a check before the name goes out:

- Already interviewed for this team here → pitch a different team
- Submitted to this client recently → confirm it is dead first
- Submitted anywhere in the last 8 weeks → confirm no live process
- Four or more interviews via us, never offered → interview coaching first
- No CV on file → request one before submitting

## Layout

```
recruiter/
  find_candidates.py     CLI: role in, shortlist + outreach out
  psp/
    domain.py            grades, specialisms, mobility, sponsorship
    geo.py               postcode -> commute distance
    index.py             build the index from .xlsx and the CV folder
    textdump.py          build it from M365 connector text instead
    match.py             scoring and business rules
    messages.py          WhatsApp and email variation banks
    outreach.py          wa.me links and email drafts
  tests/test_matching.py
```

## Improving commute accuracy

Distances resolve at postcode-area level (the letters), which is honest to
roughly 10–20 miles outside London. For district-level accuracy, drop an ONS
postcode centroid CSV at `data/postcode_districts.csv` with columns
`district,lat,lon`; it is picked up automatically.

## Data protection

The index holds candidate names, mobiles, emails and home postcodes. `data/` is
git-ignored and must stay that way. Do not publish shortlists to a shareable
Artifact or paste them anywhere outside PSP's own systems.

## Tests

```bash
python3 -m unittest discover -s tests
```
