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
        others = sorted({h["client"] for h in m.history})
        if others:
            lines.append(f"placed into process with {', '.join(others[:4])} through us before")

    if m.position:
        lines.append(f"currently {m.position}"
                     + (f", which is {domain.GRADE_LABEL.get(m.grade, m.grade)} level" if m.grade else ""))
    spec = [h["job_title"] for h in m.history][:3]
    if spec:
        lines.append("previously put forward for " + "; ".join(spec))
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
    p.add_argument("--perks", default="", help="Comma separated, e.g. '£5k golden hello,hybrid working'")
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
    a = p.parse_args()

    job = Job.parse(
        a.client, a.title, a.postcode, sector=a.sector, sponsors=a.sponsors,
        max_miles=a.max_miles, salary_from=a.salary_from, salary_to=a.salary_to,
        salary_text=a.salary_text, team=a.team,
        perks=[x.strip() for x in a.perks.split(",") if x.strip()],
    )
    matches = find(a.db, job, limit=a.limit, min_score=a.min_score)

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
        print(f"`{m.phone or 'no phone'}`  |  `{m.email or 'no email'}`  |  "
              f"{m.location or 'location unknown'} {m.postcode or ''}".rstrip())
        for line in reasons:
            print(f"- {line}")
        if m.flags:
            for f in m.flags:
                print(f"- **CHECK:** {f}")
        wa_text = outreach.whatsapp_message(m.name, job, m.miles, a.me, a.company)
        wa_link = outreach.whatsapp_link(m.phone, wa_text)
        print(f"- WhatsApp: {wa_link or 'no usable mobile number'}")
        print()
        payload.append({
            "name": m.name, "score": m.score, "phone": m.phone, "email": m.email,
            "location": m.location, "postcode": m.postcode, "miles": m.miles,
            "reasons": reasons, "flags": m.flags, "parts": m.parts,
            "whatsapp_text": wa_text, "whatsapp_link": wa_link,
            "email_draft": outreach.email_draft(m, job, a.me, a.company, reasons),
        })

    if a.json_out:
        with open(a.json_out, "w", encoding="utf-8") as fh:
            json.dump({"job": {"client": job.client, "title": job.title,
                               "grade": job.grade, "postcode": job.postcode,
                               "specialisms": sorted(job.specialisms)},
                       "candidates": payload}, fh, indent=2)
        print(f"\nOutreach payload written to {a.json_out}")


if __name__ == "__main__":
    main()
