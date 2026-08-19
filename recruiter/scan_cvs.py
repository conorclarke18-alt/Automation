#!/usr/bin/env python3
"""Scan a local folder of CVs and write a small index Claude can read.

Runs on the machine that actually holds the CVs. Standard library only - no
pip install, no internet. Point it at a folder, it walks every subfolder,
reads each .docx, and writes one CSV row per candidate: name, contact details
found in the document, specialisms detected, and a short excerpt.

    python scan_cvs.py "C:\\Users\\ConorClarke\\Documents\\Candidate's CVs ProSocial"

The CSV is a few hundred KB even for a thousand CVs, so it can be uploaded to
a chat where the CVs themselves never could.

Old .doc files and PDFs cannot be read without extra libraries; they are still
listed, flagged as unreadable, so nothing is silently dropped.
"""
from __future__ import annotations

import csv
import os
import re
import sys
import zipfile
from datetime import datetime

# --- Specialism vocabulary (mirrors psp/domain.py) ------------------------
SPECIALISMS = {
    "CWD": [r"children with disabilit", r"\bcwd\b", r"disabled children",
            r"\bsend\b", r"\btransitions?\b", r"learning disabilit",
            r"\bautism\b", r"\behcp\b", r"short breaks", r"direct payments",
            r"sensory", r"physical impairment", r"0-25"],
    "CP/Safeguarding": [r"child protection", r"safeguard", r"\bcswt\b",
                        r"section 47", r"\bs47\b", r"\bcp\b"],
    "Assessment": [r"\bassessment\b", r"\br ?& ?a\b", r"referral and assessment",
                   r"\bduty\b", r"front door", r"\bras\b"],
    "MASH": [r"\bmash\b", r"first response", r"multi.agency safeguarding"],
    "CIC/LAC": [r"\bcic\b", r"\blac\b", r"looked after", r"children in care",
                r"corporate parenting", r"permanence"],
    "Leaving Care": [r"leaving care", r"\buasc\b", r"care leaver", r"16\+"],
    "Fostering": [r"foster", r"kinship", r"connected (person|carer)"],
    "Adoption": [r"adoption"],
    "Family Help": [r"family help", r"early help", r"children in need",
                    r"\bcin\b", r"family support"],
    "Exploitation": [r"\bcse\b", r"exploitation", r"contextual safeguarding",
                     r"missing"],
    "Court": [r"\bcourt\b", r"care proceedings", r"\bplo\b"],
    "IRO/QA": [r"\biro\b", r"cp chair", r"reviewing officer", r"\blado\b",
               r"quality assurance"],
    "Adults": [r"\badults?\b", r"\bamhp\b", r"mental health", r"hospital discharge"],
}

GRADES = [
    (r"head of service|\bhos\b|service manager", "SM/HOS"),
    (r"team manager|registered manager|practice manager", "TM"),
    (r"assistant team manager|deputy team manager|\batm\b|\bdtm\b", "ATM/DTM"),
    (r"senior practitioner|senior social worker|advanced practitioner"
     r"|advanced social worker|\bssw\b", "Senior/SP/AP"),
    (r"experienced social worker|\besw\b", "ESW"),
    (r"newly qualified|\bnqsw\b|\basye\b", "NQSW"),
    (r"social worker", "SW"),
]

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# UK mobiles and landlines, tolerating spaces, dashes and +44.
PHONE_RE = re.compile(r"(?:(?:\+|00)44\s?|0)(?:7\d{3}|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4}")
POSTCODE_RE = re.compile(
    r"\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b|\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b")
SWE_RE = re.compile(r"\bSW\s?\d{5,6}\b")
DOCX_TEXT_RE = re.compile(r"<w:t[^>]*>([^<]*)</w:t>")
YEARS_RE = re.compile(r"(\d{1,2})\+?\s*years?[\s\w]{0,20}(?:post.?qualif|experience|pq)",
                      re.IGNORECASE)


def read_docx(path):
    """Plain text from a .docx, including headers and footers."""
    chunks = []
    try:
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                if not name.startswith("word/"):
                    continue
                if not (name == "word/document.xml"
                        or name.startswith("word/header")
                        or name.startswith("word/footer")):
                    continue
                try:
                    xml = z.read(name).decode("utf-8", "ignore")
                except Exception:
                    continue
                chunks.extend(DOCX_TEXT_RE.findall(xml))
    except Exception:
        return ""
    return re.sub(r"\s+", " ", " ".join(chunks)).strip()


def candidate_name(filename):
    """Best guess at the person's name from the file name."""
    stem = os.path.splitext(os.path.basename(filename))[0]
    stem = re.sub(r"\(.*?\)", " ", stem)
    stem = re.sub(r"[_\-]+", " ", stem)
    stem = re.sub(r"\b(cv|curriculum vitae|resume|final|updated|new|copy|v\d+"
                  r"|perm|formatted|psp|pro ?social)\b", " ", stem, flags=re.I)
    stem = re.sub(r"\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}", " ", stem)
    return re.sub(r"\s+", " ", stem).strip().title()


def find_postcode(text):
    """First plausible UK outward code, preferring a full postcode."""
    for m in POSTCODE_RE.finditer(text.upper()):
        code = m.group(1) or m.group(2)
        if not code:
            continue
        # Filter out things that merely look like postcodes.
        if code in {"SW", "CV", "UK", "NO", "MR", "MS", "DR"}:
            continue
        if re.match(r"^[A-Z]{1,2}\d", code):
            return code
    return ""


def detect(text, table):
    low = text.lower()
    return [k for k, pats in table.items()
            if any(re.search(p, low) for p in pats)]


def grade_of(text):
    low = text.lower()
    for pat, label in GRADES:
        if re.search(pat, low):
            return label
    return ""


def scan(root):
    rows, unreadable = [], []
    for dirpath, _dirs, files in os.walk(root):
        for fn in sorted(files):
            if fn.startswith("~$"):
                continue
            full = os.path.join(dirpath, fn)
            ext = os.path.splitext(fn)[1].lower()
            if ext not in (".docx", ".doc", ".pdf", ".rtf", ".txt"):
                continue
            try:
                mtime = datetime.fromtimestamp(
                    os.path.getmtime(full)).strftime("%Y-%m-%d")
            except OSError:
                mtime = ""
            if ext not in (".docx", ".txt"):
                unreadable.append((candidate_name(fn), fn, ext, mtime))
                continue

            if ext == ".txt":
                try:
                    with open(full, encoding="utf-8", errors="ignore") as fh:
                        text = fh.read()
                except OSError:
                    text = ""
            else:
                text = read_docx(full)
            if not text:
                unreadable.append((candidate_name(fn), fn, ext, mtime))
                continue

            emails = EMAIL_RE.findall(text)
            phones = [re.sub(r"[\s-]", "", p) for p in PHONE_RE.findall(text)]
            phones = [p for p in phones if len(re.sub(r"\D", "", p)) >= 10]
            specs = detect(text, SPECIALISMS)
            swe = SWE_RE.search(text)
            yrs = YEARS_RE.search(text)

            rows.append({
                "name": candidate_name(fn),
                "file": os.path.relpath(full, root),
                "modified": mtime,
                "email": emails[0] if emails else "",
                "phone": phones[0] if phones else "",
                "postcode": find_postcode(text),
                "grade": grade_of(text),
                "swe_reg": swe.group(0) if swe else "",
                "years_pq": yrs.group(1) if yrs else "",
                "specialisms": "; ".join(specs),
                "is_cwd": "YES" if "CWD" in specs else "",
                "excerpt": text[:400],
            })
    return rows, unreadable


def main():
    if len(sys.argv) > 1:
        root = sys.argv[1]
    else:
        guess = os.path.join(os.path.expanduser("~"), "Documents")
        root = input(f"Folder to scan [{guess}]: ").strip().strip('"') or guess

    if not os.path.isdir(root):
        print(f"Not a folder: {root}")
        sys.exit(1)

    print(f"Scanning {root} ...")
    rows, unreadable = scan(root)
    if not rows and not unreadable:
        print("No CV files found.")
        sys.exit(1)

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cv_index.csv")
    cols = ["name", "file", "modified", "email", "phone", "postcode", "grade",
            "swe_reg", "years_pq", "specialisms", "is_cwd", "excerpt"]
    with open(out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    cwd = sum(1 for r in rows if r["is_cwd"])
    withphone = sum(1 for r in rows if r["phone"])
    withemail = sum(1 for r in rows if r["email"])
    print(f"\n  {len(rows):>5} CVs read")
    print(f"  {cwd:>5} mention children with disabilities")
    print(f"  {withemail:>5} have an email in the document")
    print(f"  {withphone:>5} have a phone number")
    if unreadable:
        u = os.path.join(os.path.dirname(out), "cv_unreadable.csv")
        with open(u, "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(["name", "file", "type", "modified"])
            w.writerows(unreadable)
        print(f"  {len(unreadable):>5} could not be read (.doc/.pdf) -> {u}")
    print(f"\nWritten: {out}")
    print("Upload that CSV to the chat.")


if __name__ == "__main__":
    main()
