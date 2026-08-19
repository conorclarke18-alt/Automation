#!/usr/bin/env python3
"""Shortlist candidates for a live vacancy, with outreach ready to send.

    python3 find_candidates.py --client Medway \
        --title "Senior Practitioner CP" --postcode ME4 \
        --salary-max 61920 --limit 10

Writes a markdown briefing to stdout and a JSON sidecar containing the
WhatsApp links and email drafts, so the review step and the sending step stay
separate. Nothing is sent by this script.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from psp import domain, geo, outreach  # noqa: E402
from psp.match import Job, find  # noqa: E402


def why_lines(m, job) -> list[str]:
    """The justification Conor reads: specialism, history, level, geography."""
    lines = []
    # m.reasons[0] is the specialism verdict and names its evidence source.
    if m.reasons:
        lines.append(m.reasons[0])
    same_client = [h for h in m.history if h["client"].lower() == job.client.lower()]
    if same_client:
        h = sorted(same_client, key=lambda r: r["submitted"] or "")[-1]
        verb = {"offered": "was offered", "interviewed": "interviewed",
                "interview_withdrawn": "interviewed (then withdrew)",
                "lost_to_other": "was submitted",
                "role_dead": "was submitted"}.get(h["outcome"], "was submitted")
        lines.append(f"{verb} for {h['job_title']} at {job.client}"
                     f"{' in ' + h['submitted'] if h['submitted'] else ''} - the client already knows them")
    else:
        # An offer elsewhere is the single strongest thing we can say, so it
        # gets its own line rather than being folded into a client list.
        offers = [h for h in m.history if h["outcome"] in ("offered", "offer_lapsed")]
        for h in offers[:2]:
            lines.append(f"OFFERED {h['job_title']} at {h['client']} - a client has already "
                         "said yes to this person")
        rejected = sorted({h["client"] for h in m.history
                           if h["outcome"] in ("rejected_at_interview", "interviewed")})
        if rejected:
            lines.append(f"interviewed via us at {', '.join(rejected[:4])}")

    if m.position:
        lines.append(f"currently {m.position}"
                     + (f", which is {domain.GRADE_LABEL.get(m.grade, m.grade)} level" if m.grade else ""))

    # Real roles only, de-duplicated. "Placement" is a bookkeeping row.
    seen, roles = set(), []
    for h in m.history:
        title = (h["job_title"] or "").strip()
        if not title or title.lower() == "placement" or title.lower() in seen:
            continue
        seen.add(title.lower())
        roles.append(title)
    if roles:
        lines.append("previously put forward for " + "; ".join(roles[:4]))
    # Conor's briefing keeps the real distance - he needs to judge it. Only the
    # candidate-facing messages soften it.
    where = m.location or m.postcode
    if m.needs_sponsorship:
        lines.append(f"based in {where or 'location unknown'} - needs sponsorship, "
                     "which this client can offer, so they will travel for it")
    elif m.mobile:
        lines.append(f"based in {where or 'location unknown'} but open to relocating")
    elif m.miles is not None:
        lines.append(f"based in {where} - {geo.commute_band(m.miles)[2]}")
    elif where:
        lines.append(f"based in {where}")
    return lines


def candidate_why(m, job) -> list[str]:
    """Candidate-facing reasons. A different audience from why_lines().

    Conor's briefing cites rejections, prior offers and named clients. None of
    that can go to the candidate: it exposes other clients' decisions, reveals
    that we track their knockbacks, and reads as sales copy about them rather
    than to them. This says only what is true, flattering and theirs to know.
    """
    lines = []
    spec = ", ".join(domain.SPECIALISMS[s]["label"] for s in sorted(job.specialisms))
    if spec and m.parts.get("specialism", 0) >= 0.9:
        lines.append(f"Your background is squarely in {spec}, which is exactly this team")
    elif spec:
        lines.append(f"Your experience carries across well into {spec}")
    if m.position and m.grade == job.grade:
        lines.append(f"It is a {domain.GRADE_LABEL.get(job.grade, job.grade)} post, "
                     "so it matches the level you are already working at")
    elif m.grade and job.grade and domain.grade_distance(m.grade, job.grade) == -1:
        lines.append("It would be a step up from where you are now")
    if m.needs_sponsorship:
        lines.append("This client is able to offer sponsorship")
    elif m.mobile:
        lines.append("You had mentioned being open to a move, and this is a permanent post")
    elif m.miles is not None and m.miles <= 45:
        lines.append("The location is very manageable from you")
    return lines


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db", default=os.path.join(os.path.dirname(__file__), "data", "psp.db"))
    p.add_argument("--client", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--postcode", help="Client office postcode, drives commute scoring")
    p.add_argument("--sector", choices=["childrens", "adults"])
    p.add_argument("--salary-from", type=float)
    p.add_argument("--salary-to", type=float)
    p.add_argument("--salary-text", help="Override, e.g. 'a package of £61,920'")
    # Semicolon, not comma: perks routinely contain "£5,000".
    p.add_argument("--perks", default="",
                   help="Semicolon separated, e.g. 'a £5,000 golden hello;hybrid working'")
    p.add_argument("--team", help="Team name, used in the email pitch")
    p.add_argument("--sponsors", action="store_true",
                   help="Client can sponsor visas. Without this, candidates who "
                        "need sponsorship are excluded rather than wasted.")
    p.add_argument("--max-miles", type=float, default=60.0,
                   help="Ignored for candidates who will relocate or need sponsorship")
    p.add_argument("--limit", type=int, default=12)
    p.add_argument("--min-score", type=float, default=35.0)
    p.add_argument("--me", default="Conor")
    p.add_argument("--company", default="Pro Social Partners")
    p.add_argument("--json-out", help="Write outreach payload here")
    p.add_argument("--context", help="JSON with facts/extras/warnings for the report")
    p.add_argument("--docx-out", help="Write a Word campaign sheet with clickable links")
    p.add_argument("--html-out", help="Write an HTML campaign sheet with buttons")
    a = p.parse_args()

    job = Job.parse(
        a.client, a.title, a.postcode, sector=a.sector, sponsors=a.sponsors,
        max_miles=a.max_miles, salary_from=a.salary_from, salary_to=a.salary_to,
        salary_text=a.salary_text, team=a.team,
        perks=[x.strip() for x in a.perks.split(";") if x.strip()],
    )
    matches = find(a.db, job, limit=a.limit, min_score=a.min_score)

    context = {}
    if a.context:
        with open(a.context, encoding="utf-8") as fh:
            context = json.load(fh)
    job_facts = context.get("facts", [])
    extras = [(e["name"], e["why"]) for e in context.get("extras", [])]
    warnings = context.get("warnings", [])

    spec_labels = ", ".join(domain.SPECIALISMS[s]["label"] for s in sorted(job.specialisms)) or "unspecified"
    print(f"# {job.client} - {job.title}\n")
    print(f"Level: {domain.GRADE_LABEL.get(job.grade, job.grade or 'unspecified')}  |  "
          f"Specialism: {spec_labels}  |  Sector: {job.sector}"
          + (f"  |  Base: {job.postcode}" if job.postcode else ""))
    print(f"\n{len(matches)} candidates above threshold.\n")

    payload = []
    for i, m in enumerate(matches, 1):
        reasons = why_lines(m, job)
        print(f"## {i}. {m.name}  ({m.score}/100)")
        place = " ".join(x for x in (m.location, m.postcode) if x) or "location unknown"
        print(f"`{m.phone or 'no phone'}`  |  `{m.email or 'no email'}`  |  {place}")
        for line in reasons:
            print(f"- {line}")
        if m.flags:
            for f in m.flags:
                print(f"- **CHECK:** {f}")
        wa_text = outreach.whatsapp_message(m.name, job, m.miles, a.me, a.company)
        wa_link = outreach.whatsapp_link(m.phone, wa_text)
        wa_web = outreach.whatsapp_web_link(m.phone, wa_text)
        draft = outreach.email_draft(m, job, a.me, a.company, candidate_why(m, job))
        print(f"- WhatsApp: {wa_link or 'no usable mobile number'}")
        print()
        payload.append({
            "name": m.name, "score": m.score, "phone": m.phone, "email": m.email,
            "location": m.location, "postcode": m.postcode, "miles": m.miles,
            "reasons": reasons, "flags": m.flags, "parts": m.parts,
            "whatsapp_text": wa_text, "whatsapp_link": wa_link,
            "whatsapp_web_link": wa_web,
            # Internal reasons stay in `reasons`; the email gets the safe set.
            "email_draft": draft,
            "mailto_link": outreach.mailto_link(m.email, draft["subject"], draft["body"]),
        })

    def tier_of(c):
        spec = c["parts"]["specialism"]
        mi = c["miles"] if c["miles"] is not None else 999
        if spec >= 0.9 and mi <= 40:
            return "A"
        if spec >= 0.9:
            return "B"
        if mi <= 25:
            return "C"
        return "D"

    TIER_TEXT = {
        "A": ("A. Right specialism, commutable - go first",
              "They have done this work and they can get there."),
        "B": ("B. Right specialism, longer commute",
              "Real depth in the specialism. Lead with the package, not the postcode."),
        "C": ("C. Frontline on the doorstep",
              "No direct specialism on record, but close enough that the commute sells itself."),
        "D": ("D. Frontline, wider net",
              "Safeguarding and assessment people who would consider this team."),
    }
    tiers = [(TIER_TEXT[t][0], TIER_TEXT[t][1],
              [c for c in payload if tier_of(c) == t]) for t in "ABCD"]
    job_meta = {"client": job.client, "title": job.title, "facts": job_facts}

    if a.docx_out:
        from psp import docx_report
        docx_report.build(a.docx_out, job_meta, tiers, extras, warnings)
        print(f"\nWord campaign sheet written to {a.docx_out}")
    if a.html_out:
        from psp import report
        with open(a.html_out, "w", encoding="utf-8") as fh:
            fh.write(report.render(job_meta, tiers, extras, warnings))
        print(f"HTML campaign sheet written to {a.html_out}")

    if a.json_out:
        with open(a.json_out, "w", encoding="utf-8") as fh:
            json.dump({"job": {"client": job.client, "title": job.title,
                               "grade": job.grade, "postcode": job.postcode,
                               "specialisms": sorted(job.specialisms)},
                       "candidates": payload}, fh, indent=2)
        print(f"\nOutreach payload written to {a.json_out}")


if __name__ == "__main__":
    main()
