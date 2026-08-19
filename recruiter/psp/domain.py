"""Social work recruitment domain model: grades, specialisms, sectors.

Encodes the vocabulary Pro Social Partners actually uses in the master
candidate list, the submission spreadsheet and candidate CVs, so that free
text like "SP CSWT" or "ESW Corporate Parenting" resolves to a comparable
(grade, specialism) pair.
"""
from __future__ import annotations

import re

# --- Grade ladder ---------------------------------------------------------
# Rung numbers are ordinal, not linear: the gap between SW and ESW is smaller
# than the gap between TM and SM. Comparison logic uses the delta, so keep the
# ladder dense enough that a one-rung move reads as a plausible step.
GRADE_LADDER = {
    "nqsw": 0,   # newly qualified / ASYE
    "sw": 1,     # social worker
    "esw": 2,    # experienced social worker
    "ssw": 3,    # senior social worker / senior practitioner / advanced practitioner
    "atm": 4,    # assistant / deputy team manager
    "tm": 5,     # team manager / registered manager / practice manager
    "sm": 6,     # service manager / head of service
}

GRADE_LABEL = {
    "nqsw": "NQSW/ASYE",
    "sw": "Social Worker",
    "esw": "Experienced SW",
    "ssw": "Senior SW / SP / AP",
    "atm": "ATM / DTM",
    "tm": "Team Manager",
    "sm": "Service Manager / HOS",
    "reviewing": "IRO / CP Chair / Panel",
}

# Longest patterns first — "senior practitioner" must beat a bare "sw".
GRADE_PATTERNS: list[tuple[str, str]] = [
    (r"\bhead of service\b|\bhos\b|\bservice manager\b|\bsm\b|\bhos\b", "sm"),
    (r"\bregistered manager\b|\brm\b|\bteam manager\b|\btm\b|\bpractice manager\b|\bpm\b", "tm"),
    (r"\bassistant team manager\b|\batm\b|\bdeputy team manager\b|\bdtm\b|\bdeputy manager\b", "atm"),
    (r"\bsenior practitioner\b|\bsenior social worker\b|\badvanced (social worker|practitioner)\b"
     r"|\bssw\b|\bsp\b|\bap\b|\basw\b|\bsenior sw\b|\bsenior\b", "ssw"),
    # Principal SW is a strategic practice post, not a caseholding SW job -
    # catch it before the bare "social worker" pattern below.
    (r"\bprincipal social worker\b|\bprincipal sw\b", "reviewing"),
    (r"\bexperienced social worker\b|\bexperienced sw\b|\besw\b", "esw"),
    (r"\bnewly qualified\b|\bnqsw\b|\basye\b|\bnq\b", "nqsw"),
    (r"\bsocial worker\b|\bsw\b", "sw"),
]

# Non-caseholding / quality-assurance track. Sits outside the ladder: an IRO is
# not "above" a TM, it is sideways, and candidates move between the two.
REVIEWING_PATTERN = (
    r"\biro\b|\bcp chair\b|\bchild protection chair\b|\breviewing officer\b"
    r"|\bpanel advisor\b|\blado\b|\bquality assurance\b|\bqa\b|\bprincipal social worker\b"
    r"|\bpractice development\b|\bpractice educator\b"
)

# --- Specialisms ----------------------------------------------------------
# Each specialism carries the aliases that appear in PSP's own data. The
# submission spreadsheet is written in shorthand ("SP CSWT", "SW FH"), so the
# abbreviations matter as much as the full names.
SPECIALISMS: dict[str, dict] = {
    "cp": {
        "label": "Child Protection / Safeguarding",
        "aliases": [r"\bcp\b", r"safeguard", r"\bcswt\b", r"child protection",
                    r"family safeguarding", r"\bcin/cp\b"],
    },
    "assessment": {
        "label": "Assessment / R&A / Duty",
        "aliases": [r"\bassessment\b", r"\br ?& ?a\b", r"referral and assessment",
                    r"\bduty\b", r"front door", r"\bras\b", r"first response",
                    r"parenting assessment"],
    },
    "mash": {
        "label": "MASH",
        "aliases": [r"\bmash\b", r"multi.agency safeguarding"],
    },
    "cic": {
        "label": "Children in Care / LAC",
        "aliases": [r"\bcic\b", r"\blac\b", r"\bcla\b", r"children in care",
                    r"looked after", r"corporate parenting", r"\bpermanence\b",
                    r"\blong term\b"],
    },
    "cwd": {
        "label": "Children with Disabilities",
        "aliases": [r"\bcwd\b", r"children with disabilit", r"\bsend\b",
                    r"\btransitions?\b", r"\b0-25\b", r"disabled children"],
    },
    "leaving_care": {
        "label": "Leaving Care / 16+ / UASC",
        "aliases": [r"leaving care", r"\blc\b", r"\b16\+", r"\buasc\b",
                    r"care leaver", r"unaccompanied"],
    },
    "fostering": {
        "label": "Fostering / Kinship",
        "aliases": [r"foster", r"\bkinship\b", r"connected (person|carer)",
                    r"\bssw fostering\b", r"\bifa\b", r"mockingbird"],
    },
    "adoption": {
        "label": "Adoption",
        "aliases": [r"adoption", r"\bpost order\b"],
    },
    "family_help": {
        "label": "Family Help / Early Help / CIN",
        "aliases": [r"\bfh\b", r"family help", r"early help", r"\bcin\b",
                    r"children in need", r"family support", r"\blocality\b"],
    },
    "exploitation": {
        "label": "Exploitation / CSE / Contextual Safeguarding",
        "aliases": [r"\bcse\b", r"exploitation", r"contextual safeguarding",
                    r"\bsash\b", r"adolescent", r"harm outside", r"missing"],
    },
    "court": {
        "label": "Court / Care Proceedings",
        "aliases": [r"\bcourt\b", r"care proceedings", r"\bplo\b", r"public law"],
    },
    "reviewing": {
        "label": "IRO / CP Chair / Panel / QA",
        "aliases": [REVIEWING_PATTERN],
    },
    "adults": {
        "label": "Adults",
        "aliases": [r"\badults?\b", r"learning disabilit", r"\bld\b",
                    r"mental health", r"\bamhp\b", r"\bhospital\b", r"discharge",
                    r"\bmist\b", r"\bbia\b", r"care management", r"shared lives"],
    },
}

# Specialisms that transfer well between each other. Used to award partial
# credit: a CIC worker is a credible LAC/permanence applicant, and a CP worker
# can usually cover assessment.
ADJACENT: dict[str, set[str]] = {
    "cp": {"assessment", "mash", "court", "family_help"},
    "assessment": {"cp", "mash", "family_help"},
    "mash": {"assessment", "cp"},
    "cic": {"leaving_care", "fostering", "cwd", "adoption"},
    "cwd": {"cic", "leaving_care"},
    "leaving_care": {"cic", "cwd"},
    "fostering": {"adoption", "cic"},
    "adoption": {"fostering", "cic"},
    "family_help": {"cp", "assessment"},
    "exploitation": {"cp", "cic", "leaving_care"},
    "court": {"cp", "assessment"},
    "reviewing": {"cp", "cic"},
    "adults": set(),
}


def normalise(text: str | None) -> str:
    """Lowercase and collapse punctuation so alias patterns match reliably."""
    if not text:
        return ""
    return re.sub(r"[^a-z0-9+&/ -]+", " ", str(text).lower())


def parse_grade(text: str | None) -> str | None:
    """Resolve free text to a grade key, or None if nothing matches."""
    t = normalise(text)
    if not t:
        return None
    # An explicit ladder grade wins over the reviewing keywords: "HOS
    # Safeguarding QA" is a Head of Service post that happens to cover QA, not
    # a QA post. Titles with no ladder grade at all - IRO, CP Chair, LADO,
    # Panel Advisor - fall through to the reviewing track.
    for pattern, grade in GRADE_PATTERNS:
        if re.search(pattern, t):
            return grade
    if re.search(REVIEWING_PATTERN, t):
        return "reviewing"
    return None


def parse_specialisms(text: str | None) -> set[str]:
    """Return every specialism mentioned in the text (roles are often plural)."""
    t = normalise(text)
    found: set[str] = set()
    if not t:
        return found
    for key, spec in SPECIALISMS.items():
        if any(re.search(alias, t) for alias in spec["aliases"]):
            found.add(key)
    return found


def parse_sector(text: str | None) -> str | None:
    """Childrens vs adults. Adults work is a hard boundary for most clients."""
    t = normalise(text)
    if not t:
        return None
    if re.search(r"\badults?\b|learning disabilit|mental health|\bamhp\b|\bbia\b", t):
        return "adults"
    if re.search(r"\bchildren|\bcp\b|foster|\bcic\b|\blac\b|\bcwd\b|\bcswt\b", t):
        return "childrens"
    return None


def grade_distance(candidate: str | None, required: str | None) -> int | None:
    """Rungs between two grades. Positive = candidate sits above the role.

    Returns None when either side is unknown or on the reviewing track, which
    is not comparable to the frontline ladder.
    """
    if candidate not in GRADE_LADDER or required not in GRADE_LADDER:
        return None
    return GRADE_LADDER[candidate] - GRADE_LADDER[required]


def specialism_overlap(candidate: set[str], required: set[str]) -> tuple[float, str]:
    """Score 0..1 for specialism fit, plus a human-readable reason."""
    if not required:
        return 0.5, "no specialism stated on the role"
    if not candidate:
        return 0.0, "no specialism evidence on file"
    direct = candidate & required
    if direct:
        labels = ", ".join(SPECIALISMS[s]["label"] for s in sorted(direct))
        return 1.0, f"direct match on {labels}"
    adjacent = {a for r in required for a in ADJACENT.get(r, set())} & candidate
    if adjacent:
        labels = ", ".join(SPECIALISMS[s]["label"] for s in sorted(adjacent))
        return 0.55, f"adjacent experience in {labels}"
    return 0.1, "different specialism"


# --- Mobility and sponsorship --------------------------------------------
# Distance is only a barrier for people who are anchored. A candidate who is
# actively relocating, or who needs a visa the client can sponsor, will travel
# much further than a commute model would ever predict - and sponsorship
# candidates are among the most motivated on the book, because the number of
# employers who can help them is small.

MOBILITY_PATTERN = (
    r"relocat|\banywhere\b|\bflexible\b|will move|willing to move|open to any"
    r"|nationwide|any county|any area|any region|happy to travel|willing to travel"
    r"|no fixed location|will travel|moving (to|north|south|east|west|back|closer|away)"
)

SPONSORSHIP_PATTERN = (
    r"\bsponsor|\bvisa\b|\bcos\b|certificate of sponsorship|skilled worker"
    r"|\btier 2\b|work permit|sponsorship transfer|switch employer"
    r"|right to work restrict"
)


def parse_mobility(*texts: str | None) -> bool:
    """True when anything on file says this person will move for the right role."""
    return any(re.search(MOBILITY_PATTERN, normalise(t)) for t in texts if t)


def parse_sponsorship_need(*texts: str | None) -> bool:
    """True when the record mentions sponsorship, a visa or a CoS transfer."""
    return any(re.search(SPONSORSHIP_PATTERN, normalise(t)) for t in texts if t)
