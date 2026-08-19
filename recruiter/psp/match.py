"""Score candidates against a live vacancy.

Four things decide a shortlist, in the order a recruiter actually weighs them:
what the person does (specialism), what level they do it at (grade), whether
they can physically get there (commute), and what history we already have with
that client (track record). Everything else is a flag on top.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import date, datetime

from . import domain, geo

# Default weighting, for a candidate who is anchored to a patch.
WEIGHTS = {"specialism": 30.0, "grade": 20.0, "commute": 25.0, "history": 25.0}

# Weighting for someone who will move - actively relocating, or a sponsorship
# candidate the client can actually sponsor. Distance stops being the question
# and what they can DO becomes the question. Both sets total 100.
MOBILE_WEIGHTS = {"specialism": 38.0, "grade": 26.0, "commute": 6.0, "history": 30.0}

# How a prior outcome with THIS client colours a fresh approach.
# score is 0..1 on the history axis; the note is written into the shortlist.
HISTORY_SIGNALS = {
    "offered":            (1.00, "was OFFERED by this client before"),
    "offer_lapsed":       (0.90, "was offered here but never started - worth reopening"),
    "placed":             (0.05, "we PLACED them here - do not approach"),
    "rejected_at_interview": (0.50, "interviewed here and was not offered"),
    "interviewed":        (0.85, "has interviewed with this client"),
    "interview_withdrawn": (0.55, "interviewed here before but withdrew"),
    "submitted":          (0.65, "submitted to this client before"),
    "lost_to_other":      (0.35, "went elsewhere last time"),
    "role_dead":          (0.60, "previous role here died, not their fault"),
}


@dataclass
class Job:
    """A vacancy to match against."""
    client: str
    title: str
    postcode: str | None = None
    grade: str | None = None
    specialisms: set[str] = field(default_factory=set)
    sector: str = "childrens"
    sponsors: bool = False
    max_miles: float = 60.0
    # Selling detail, used by the outreach templates.
    salary_from: float | None = None
    salary_to: float | None = None
    salary_text: str | None = None
    perks: list[str] = field(default_factory=list)
    team: str | None = None

    @classmethod
    def parse(cls, client: str, title: str, postcode: str | None = None, **kw) -> "Job":
        """Infer grade, specialism and sector from the job title text."""
        return cls(
            client=client,
            title=title,
            postcode=postcode,
            grade=kw.pop("grade", None) or domain.parse_grade(title),
            specialisms=kw.pop("specialisms", None) or domain.parse_specialisms(title),
            sector=kw.pop("sector", None) or domain.parse_sector(title) or "childrens",
            **kw,
        )


@dataclass
class Match:
    name: str
    name_key: str
    score: float
    grade: str | None
    position: str | None
    location: str | None
    postcode: str | None
    miles: float | None
    phone: str | None
    email: str | None
    reasons: list[str]
    flags: list[str]
    history: list[dict]
    has_cv: bool
    parts: dict
    mobile: bool = False
    needs_sponsorship: bool = False


def _months_since(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        d = datetime.strptime(iso, "%Y-%m-%d").date()
    except ValueError:
        return None
    return (date.today() - d).days / 30.44


def _grade_score(cand: str | None, job: Job) -> tuple[float, str]:
    """Reward exact level; allow a single step up, penalise a drop in level."""
    if not job.grade:
        return 0.6, "role level not stated"
    if cand is None:
        return 0.35, "current level unknown"
    if cand == job.grade:
        return 1.0, f"already at {domain.GRADE_LABEL.get(cand, cand)} level"
    if cand == "reviewing" or job.grade == "reviewing":
        return 0.45, "moving between frontline and reviewing work"
    delta = domain.grade_distance(cand, job.grade)
    if delta is None:
        return 0.4, "level not comparable"
    if delta == -1:
        return 0.75, f"step up from {domain.GRADE_LABEL.get(cand, cand)}"
    if delta == 1:
        return 0.5, f"step down from {domain.GRADE_LABEL.get(cand, cand)} - check appetite"
    if delta < -1:
        return 0.15, f"{-delta} levels below the role"
    return 0.2, f"{delta} levels above the role"


def _history_for(rows: list[dict], job: Job) -> tuple[float, list[str], list[str]]:
    """Turn submission history into a score, talking points and warnings."""
    reasons: list[str] = []
    flags: list[str] = []
    same_client = [r for r in rows if r["client"].lower() == job.client.lower()]
    best = 0.0

    for r in same_client:
        score, phrase = HISTORY_SIGNALS.get(r["outcome"], (0.5, "has history with this client"))
        months = _months_since(r["submitted"])
        # Same client AND same specialism that already failed = don't re-run it.
        same_team = bool(job.specialisms & set(filter(None, r["specialisms"].split(","))))
        if same_team and r["outcome"] in ("interviewed", "interview_withdrawn",
                                          "rejected_at_interview"):
            flags.append(
                f"already interviewed for {r['job_title']} here"
                f"{f' {months:.0f} months ago' if months else ''} - pitch a different team")
            score *= 0.5
        if r["outcome"] == "submitted" and months is not None and months < 3:
            flags.append(f"submitted to {job.client} for {r['job_title']} "
                         f"{months:.0f} months ago - check it is dead before re-submitting")
        when = f" ({r['submitted']})" if r["submitted"] else ""
        reasons.append(f"{phrase} - {r['job_title']}{when}")
        best = max(best, score)

    if not same_client:
        # No history here, but a strong record elsewhere still counts.
        offers = [r for r in rows if r["outcome"] == "offered"]
        ivs = [r for r in rows if r["outcome"] == "interviewed"]
        if offers:
            best = 0.6
            r = offers[0]
            reasons.append(f"offered elsewhere - {r['job_title']} at {r['client']}")
        elif ivs:
            best = 0.5
            clients = sorted({r["client"] for r in ivs})[:3]
            reasons.append(f"interviewed via us at {', '.join(clients)}")
        elif rows:
            best = 0.4
            reasons.append(f"{len(rows)} previous submission(s) via us, no interview yet")
        else:
            best = 0.25
            reasons.append("no submission history on file")

    # Serial shortlister: many interviews, never converts. Worth flagging.
    ivs_all = [r for r in rows if r["outcome"] in ("interviewed", "interview_withdrawn",
                                                   "rejected_at_interview")]
    if len(ivs_all) >= 4 and not any(r["outcome"] == "offered" for r in rows):
        flags.append(f"{len(ivs_all)} interviews via us, never offered - interview coaching first")

    recent = [m for m in (_months_since(r["submitted"]) for r in rows) if m is not None]
    if recent and min(recent) < 2:
        flags.append("submitted somewhere in the last 8 weeks - confirm they are not in a live process")

    return best, reasons, flags


def find(db: str, job: Job, limit: int = 15, min_score: float = 35.0) -> list[Match]:
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row

    subs: dict[str, list[dict]] = {}
    for r in conn.execute("SELECT * FROM submissions"):
        subs.setdefault(r["name_key"], []).append(dict(r))

    cvs = {r["name_key"]: dict(r) for r in conn.execute("SELECT * FROM cvs")}

    results: list[Match] = []
    for row in conn.execute("SELECT * FROM candidates"):
        key = row["name_key"]

        # Adults and children's are separate labour markets. Only cross when
        # the candidate's own record says they want to.
        if row["sector"] and row["sector"] != job.sector:
            crossing = "transition" in domain.normalise(row["notes"] or "")
            if not crossing:
                continue

        history_rows = subs.get(key, [])
        cv = cvs.get(key)

        # Specialism evidence: CV first, then what we have submitted them for,
        # then their job title in the master list.
        evidence: set[str] = set()
        source = "master list position"
        if cv and cv["specialisms"]:
            evidence |= set(filter(None, cv["specialisms"].split(",")))
            source = "CV on file"
        for r in history_rows:
            evidence |= set(filter(None, r["specialisms"].split(",")))
        if not evidence:
            evidence = domain.parse_specialisms(row["position"])

        # Mobility and visa status are read from every text we hold on them.
        texts = [row["notes"], row["address"], row["position"],
                 cv["excerpt"] if cv else None]
        mobile = domain.parse_mobility(*texts)
        needs_sponsorship = domain.parse_sponsorship_need(*texts)

        # A sponsorship candidate and a client who cannot sponsor is a dead
        # end - it wastes the candidate's time and the client's goodwill.
        if needs_sponsorship and not job.sponsors:
            continue

        s_score, s_reason = domain.specialism_overlap(evidence, job.specialisms)
        g_score, g_reason = _grade_score(row["grade"], job)
        miles = geo.miles_between(row["postcode"], job.postcode) if job.postcode else None
        band, c_score, c_reason = geo.commute_band(miles)
        h_score, h_reasons, flags = _history_for(history_rows, job)

        # Someone who will move is judged on capability, not postcode.
        will_move = mobile or (needs_sponsorship and job.sponsors)
        weights = MOBILE_WEIGHTS if will_move else WEIGHTS
        if will_move:
            c_score = max(c_score, 0.7)

        # Only exclude on distance when they are actually anchored.
        if miles is not None and miles > job.max_miles and not will_move:
            continue

        # Never poach a client's own staff back into that client's vacancy.
        if any(h["client"].lower() == job.client.lower() and h["outcome"] == "placed"
               for h in history_rows):
            continue

        total = (s_score * weights["specialism"] + g_score * weights["grade"]
                 + c_score * weights["commute"] + h_score * weights["history"])

        extra_reasons = []
        if needs_sponsorship and job.sponsors:
            # Rare and valuable: few employers can help, so conversion is high.
            total += 6.0
            extra_reasons.append("needs sponsorship and this client sponsors - "
                                 "a small field of employers can help them, so they convert well")
        elif mobile:
            extra_reasons.append("open to relocating, so distance is not the blocker it looks like")

        if total < min_score:
            continue

        if not cv:
            flags.append("no CV in the Candidate CVs folder - request one before submitting")

        results.append(Match(
            name=row["name"], name_key=key, score=round(total, 1),
            grade=row["grade"], position=row["position"],
            location=row["address"], postcode=row["postcode"], miles=miles,
            phone=row["phone"], email=row["email"],
            reasons=[f"{s_reason} ({source})", g_reason]
                    + ([] if will_move else [c_reason]) + extra_reasons + h_reasons,
            flags=flags, history=history_rows, has_cv=bool(cv),
            parts={"specialism": round(s_score, 2), "grade": round(g_score, 2),
                   "commute": round(c_score, 2), "history": round(h_score, 2)},
            mobile=mobile, needs_sponsorship=needs_sponsorship,
        ))

    conn.close()
    results.sort(key=lambda m: m.score, reverse=True)
    return results[:limit]
