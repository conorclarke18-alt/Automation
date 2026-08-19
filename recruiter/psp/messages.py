"""Message banks for candidate outreach.

Two rules shape everything here.

1. Variation is STRUCTURAL, not cosmetic. Swapping synonyms leaves the same
   sentence skeleton behind, which is exactly what bulk-message detection
   looks for. Each message is assembled from a different shape (opener, hook,
   sell, context, ask, sign-off) and each slot is chosen independently.

2. The message SELLS. A social worker on a decent salary does not move for a
   vacancy notice, they move for a package, a team and a reason. So the money
   and the pitch lead; the fit reasoning follows.

Distance is deliberately vague. "About 31 miles" invites a no before they have
heard the offer; "not too far from you" keeps the conversation open, and the
real commute gets discussed on the call.

Selection is deterministic on (candidate, role): regenerating a shortlist
produces the same message rather than a new one, so nobody ever receives two
different versions of the same approach.
"""
from __future__ import annotations

import hashlib

# --- WhatsApp -------------------------------------------------------------
# Short on purpose. A long opener from an unrecognised number reads as spam to
# the recipient, and recipient reports are what actually get a number banned.

WA_OPENERS = [
    "Hi {first}, it's {me} at {company}.",
    "Hi {first}, {me} here from {company}.",
    "Morning {first}, {me} at {company}.",
    "Hi {first} - {me}, {company}.",
    "Hello {first}, this is {me} from {company}.",
    "Hi {first}, {me} from {company} here.",
]

WA_HOOKS = [
    "I've got a {title} at {client} that I think you'd really want to hear about.",
    "{client} are recruiting a {title} and it's one of the better ones I've had on.",
    "A {title} role has landed at {client} and you were the first person I thought of.",
    "Something good has come up at {client} - {title} - and it's very much your patch.",
    "We're working a {title} post with {client} and honestly it's a strong one.",
    "{client} have a {title} opening and I'd back you for it.",
]

# The pitch. {money} is pre-formatted by outreach.py and may be empty, in
# which case the fallback lines carry the sell instead.
WA_SELL_MONEY = [
    "It's paying {money}.",
    "Package is {money}.",
    "They're paying {money} for it.",
    "Money is {money}.",
    "It comes in at {money}.",
]

WA_SELL_GENERIC = [
    "Permanent, established team, and they move quickly.",
    "It's a permanent post with a supportive team behind it.",
    "Good team, manageable caseloads, and a proper career step.",
    "Permanent contract and a team that actually retains people.",
    "Stable team, and they're genuinely invested in developing people.",
]

WA_PERKS = [
    "There's also {perk}.",
    "They're offering {perk} on top.",
    "Plus {perk}.",
]

# Vague by design - see module docstring.
WA_CONTEXT = [
    "It's not too far from you either.",
    "Location works well for you too.",
    "It's a comfortable run from your side.",
    "Commute-wise it's very doable from you.",
    "",
]

WA_ASKS = [
    "Worth a quick chat?",
    "Want me to send the details?",
    "Shall I put the spec in front of you?",
    "Interested in hearing more?",
    "Free for five minutes this week?",
    "Want the full details?",
]

WA_SIGNOFFS = ["", " Thanks, {me}", " - {me}", " Cheers, {me}"]

# --- Email ----------------------------------------------------------------

EMAIL_SUBJECTS = [
    "{title} at {client}{money_suffix}",
    "{client} - {title}{money_suffix}",
    "{title} vacancy at {client}{money_suffix}",
    "Thought of you: {title} at {client}",
    "{client} are hiring a {title}{money_suffix}",
    "A {title} role worth a look - {client}",
]

EMAIL_OPENERS = [
    "Hi {first},\n\nI hope you're keeping well.",
    "Hi {first},\n\nHope things are good with you.",
    "Hi {first},\n\nHope you're well.",
    "Hi {first},\n\nHope the week is treating you kindly.",
]

EMAIL_BRIDGES = [
    "A {title} role has come up with {client} and I wanted to get it in front of you before it goes any further.",
    "{client} are recruiting a {title}, and going back through your details you're a genuinely strong fit for it.",
    "I'm working a {title} vacancy with {client} at the moment and you came straight to mind.",
    "We've been asked to find a {title} for {client}, and your background lines up unusually well with what they want.",
]

EMAIL_CLOSERS = [
    "If it's of interest, reply here or give me a call and I'll talk you through the detail.",
    "Happy to send the full job description over - just say the word.",
    "Let me know if you'd like the spec and I'll get it across to you today.",
    "If you'd like to hear more, I can call you at a time that suits.",
    "Worth a quick conversation? I can work around your day.",
]

# Generic benefits used when the role has no stated perks, so the "what's good
# about it" section is never empty.
EMAIL_STOCK_BENEFITS = [
    "Permanent contract rather than agency - stability and a proper career path",
    "An established team with realistic caseloads",
    "A client we place into regularly, so the process tends to move quickly",
]


def pick(bank: list[str], *seed_parts: str) -> str:
    """Deterministically choose one entry from a bank for a given seed."""
    seed = "|".join(str(p) for p in seed_parts)
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return bank[digest[0] % len(bank)]
