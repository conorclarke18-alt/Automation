"""Load PSP spreadsheets from the Microsoft 365 connector's text rendering.

The connector serves .xlsx as text rather than bytes, in this shape:

    ## Sheet: Medway - 331 rows x 4 columns (A1:D331)
    NAME<TAB>DATE SUBMITTED<TAB>JOB TITLE<TAB>INTERVIEW DATE
    Anthonia Hill<TAB>3/13/2024<TAB>IRO/TM<TAB>Interview

Parsing that directly means the index can be rebuilt from a Claude session
with the connector attached - no local file access, no download step. The
openpyxl path in index.py stays available for running on a machine that has
the real workbooks.
"""
from __future__ import annotations

import re
import sqlite3
from typing import Iterator

from . import domain, geo, index

SHEET_RE = re.compile(r"^##\s*Sheet:\s*(.+?)\s+[-—]\s+", re.MULTILINE)


def iter_sheets(text: str) -> Iterator[tuple[str, list[list[str]]]]:
    """Yield (sheet_name, rows) for every sheet block in a connector dump."""
    marks = list(SHEET_RE.finditer(text))
    for i, m in enumerate(marks):
        name = m.group(1).strip()
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        block = text[m.end():end]
        # Skip the remainder of the header line, then read the tabular body.
        lines = block.split("\n")[1:]
        rows = []
        for line in lines:
            if not line.strip() or line.startswith("##") or line.startswith("["):
                continue
            if line.startswith("Formulas") or line.startswith("Workbook:"):
                break
            rows.append(line.split("\t"))
        if rows:
            yield name, rows


def _headers(row: list[str]) -> dict[str, int]:
    return {domain.normalise(c).strip(): i for i, c in enumerate(row) if c.strip()}


def _cell(row: list[str], idx: int | None) -> str | None:
    if idx is None or idx >= len(row):
        return None
    v = row[idx].strip()
    return v or None


def load_candidates_text(conn: sqlite3.Connection, text: str) -> int:
    """Ingest a MAIN CANDIDATE LIST dump. Later duplicates are ignored."""
    existing = {r[0] for r in conn.execute("SELECT name_key FROM candidates")}
    rows = []
    for sheet, body in iter_sheets(text):
        hdr = _headers(body[0])
        i_name = index._pick(hdr, "name")
        if i_name is None:
            continue
        i_addr, i_pc = index._pick(hdr, "address"), index._pick(hdr, "postcode", "post code")
        i_num = index._pick(hdr, "number", "phone")
        i_email = index._pick(hdr, "email")
        i_sector = index._pick(hdr, "adults/childrens", "adults", "sector")
        i_pos = index._pick(hdr, "current position", "position")
        i_notes = index._pick(hdr, "notes")
        for row in body[1:]:
            name = _cell(row, i_name)
            if not name:
                continue
            key = index.name_key(name)
            if not key or key in existing:
                continue
            existing.add(key)
            postcode = _cell(row, i_pc)
            position = _cell(row, i_pos)
            rows.append((
                key, name, _cell(row, i_addr), postcode, geo.outward(postcode),
                _cell(row, i_num), _cell(row, i_email),
                domain.parse_sector(_cell(row, i_sector)) or domain.parse_sector(position),
                position, domain.parse_grade(position), _cell(row, i_notes), sheet,
            ))
    conn.executemany(
        "INSERT OR REPLACE INTO candidates VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return len(rows)


def load_submissions_text(conn: sqlite3.Connection, text: str) -> int:
    """Ingest a submission-spreadsheet dump. One sheet per client."""
    rows = []
    for client, body in iter_sheets(text):
        hdr = _headers(body[0])
        i_name = index._pick(hdr, "name")
        i_job = index._pick(hdr, "job title", "job", "role")
        if i_name is None or i_job is None:
            continue
        i_date = index._pick(hdr, "date submitted", "date")
        i_out = index._pick(hdr, "interview date", "interview", "outcome", "status")
        for row in body[1:]:
            name = _cell(row, i_name)
            if not name:
                continue
            job = _cell(row, i_job) or ""
            raw = _cell(row, i_out) or ""
            rows.append((
                index.name_key(name), name, client.strip(),
                index._as_date(_cell(row, i_date)), job, raw,
                index.classify_outcome(raw), domain.parse_grade(job),
                ",".join(sorted(domain.parse_specialisms(job))),
            ))
    conn.executemany("INSERT INTO submissions VALUES (?,?,?,?,?,?,?,?,?)", rows)
    return len(rows)


def ingest(db_path: str, candidate_dumps: list[str], submission_dumps: list[str]) -> dict:
    """Build or extend the index from connector text dumps on disk."""
    conn = sqlite3.connect(db_path)
    conn.executescript(index.SCHEMA)
    counts = {"candidates": 0, "submissions": 0}
    for path in candidate_dumps:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            counts["candidates"] += load_candidates_text(conn, fh.read())
    for path in submission_dumps:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            counts["submissions"] += load_submissions_text(conn, fh.read())
    conn.commit()
    conn.close()
    return counts
