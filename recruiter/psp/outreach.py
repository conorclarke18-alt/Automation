"""Generate WhatsApp deep links and email drafts for a shortlist."""
from __future__ import annotations

import re
from urllib.parse import quote

from . import messages


def normalise_phone(raw: str | None, default_cc: str = "44") -> str | None:
    """Convert a UK mobile into the digits-only form wa.me expects."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return None
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = default_cc + digits[1:]
    elif len(digits) == 10 and not digits.startswith(default_cc):
        digits = default_cc + digits
    # A UK mobile is 12 digits once the country code is on the front.
    return digits if 11 <= len(digits) <= 15 else None


def first_name(full: str) -> str:
    """First name, tidied - the master list mixes ALL CAPS and lower case.

    Short tokens are left exactly as typed: "FP Robinson" is a person who goes
    by their initials, and "Morning Fp" would be worse than "Morning FP".
    """
    part = full.strip().split()[0] if full.strip() else ""
    if len(part) <= 3 and part.isupper():
        return part
    return part.capitalize() if (part.isupper() or part.islower()) else part


def money_phrase(job) -> str:
    """Human phrasing for the package, or empty when no salary is known."""
    if job.salary_text:
        return job.salary_text
    lo, hi = job.salary_from, job.salary_to
    if lo and hi and lo != hi:
        return f"£{lo:,.0f} to £{hi:,.0f}"
    value = hi or lo
    return f"£{value:,.0f}" if value else ""


def whatsapp_message(name: str, job, miles: float | None, me: str, company: str) -> str:
    """Assemble one candidate's WhatsApp text from the variation banks.

    Shape: opener -> hook -> sell -> perk -> commute -> ask -> sign-off.
    The commute line is dropped when we have no location for them, or when the
    distance is far enough that raising it first would lose the conversation.
    """
    seed = (name, job.client, job.title)
    money = money_phrase(job)
    perk = job.perks[0] if job.perks else ""
    fields = {
        "first": first_name(name), "me": me, "company": company,
        "client": job.client, "title": job.title, "money": money, "perk": perk,
    }

    parts = [
        messages.pick(messages.WA_OPENERS, *seed, "open").format(**fields),
        messages.pick(messages.WA_HOOKS, *seed, "hook").format(**fields),
    ]
    # Lead the sell with money when we have it, otherwise pitch the role itself.
    if money:
        parts.append(messages.pick(messages.WA_SELL_MONEY, *seed, "sell").format(**fields))
    else:
        parts.append(messages.pick(messages.WA_SELL_GENERIC, *seed, "sell").format(**fields))
    if perk:
        parts.append(messages.pick(messages.WA_PERKS, *seed, "perk").format(**fields))

    context = messages.pick(messages.WA_CONTEXT, *seed, "ctx")
    if context and miles is not None and miles <= 45:
        parts.append(context.format(**fields))

    parts.append(messages.pick(messages.WA_ASKS, *seed, "ask").format(**fields))
    text = " ".join(p for p in parts if p)
    return text + messages.pick(messages.WA_SIGNOFFS, *seed, "sign").format(**fields)


def whatsapp_link(phone: str | None, text: str) -> str | None:
    """wa.me link that opens WhatsApp Web with the message pre-filled."""
    number = normalise_phone(phone)
    if not number:
        return None
    return f"https://wa.me/{number}?text={quote(text)}"


def email_draft(match, job, me: str, company: str, why_lines: list[str]) -> dict:
    """Subject and body for one candidate, ready to hand to Outlook.

    Two sections, in this order: what is good about the role, then why it fits
    them. Selling first, justifying second - the reverse reads like a rejection
    letter.
    """
    seed = (match.name, job.client, job.title)
    money = money_phrase(job)
    fields = {
        "first": first_name(match.name), "me": me, "company": company,
        "client": job.client, "title": job.title,
        # A long package description belongs in the body, not the subject line,
        # where it gets truncated by the mail client anyway.
        "money_suffix": f" ({money})" if money and len(money) <= 28 else "",
    }

    selling: list[str] = []
    if money:
        selling.append(f"Paying {money}")
    selling += list(job.perks)
    if job.team:
        selling.append(f"Team: {job.team}")
    for stock in messages.EMAIL_STOCK_BENEFITS:
        if len(selling) >= 4:
            break
        selling.append(stock)

    body = [
        messages.pick(messages.EMAIL_OPENERS, *seed, "open").format(**fields),
        "",
        messages.pick(messages.EMAIL_BRIDGES, *seed, "bridge").format(**fields),
        "",
        "What's good about it:",
    ]
    body += [f"  - {line}" for line in selling]
    body += ["", "Why I thought of you:"]
    body += [f"  - {line}" for line in why_lines]
    body += [
        "",
        messages.pick(messages.EMAIL_CLOSERS, *seed, "close").format(**fields),
        "",
        "Best regards",
        me,
        company,
    ]
    return {
        "to": match.email,
        "subject": messages.pick(messages.EMAIL_SUBJECTS, *seed, "subj").format(**fields),
        "body": "\n".join(body),
    }
