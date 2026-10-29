"""
spamcheck.py — bhejne se PEHLE automatic checklist.

Simple me: har email queue se nikalne se pehle is darwaze se guzarta hai.
Koi BLOCK rule fail ho to email RUK jayega aur wajah user ko dikhegi.
"Shak ho to mat bhejo" — deliverability ka sab se sasta usool.

Pure function hai: draft + lead + suppression list do, natija lo.
Isi liye iske tests asaan hain.

Seekhne ke liye: ye "guard clause" pattern hai — kaam shuru karne se
pehle saari pabandiyan check karo, phir aage barho.
"""
from __future__ import annotations

import re

from ..models import Lead, SpamResult

# Spam trigger words — subject ya body me hon to BLOCK
TRIGGER_WORDS = [
    "free!!!", "guaranteed", "100% profit", "double your income",
    "no risk", "act now!!!", "limited time!!!",
]

# URL shorteners — ye spam filter ko pasand nahi
SHORTENERS = ["bit.ly", "tinyurl.com", "t.ly", "shorturl.at", "ow.ly"]

MAX_WORDS = 120
MAX_LINKS = 1


def _count_links(text: str) -> int:
    return len(re.findall(r"https?://\S+", text))


def _count_words(text: str) -> int:
    return len(text.split())


def check_email(subject: str, body: str, lead: Lead,
                suppressed_emails: set[str]) -> SpamResult:
    """
    Email ka muaina. Returns SpamResult(result='pass'|'warn'|'block').
    """
    reasons: list[str] = []
    score = 0
    full = f"{subject}\n{body}"
    lower = full.lower()

    def block(reason: str, points: int = 25) -> None:
        reasons.append("BLOCK: " + reason)
        nonlocal score
        score += points

    def warn(reason: str, points: int = 10) -> None:
        reasons.append("WARN: " + reason)
        nonlocal score
        score += points

    # ---- BLOCK rules (ek bhi fail = email rukega) ----
    if not lead.email_verified:
        block("lead ki email verified nahi hai")
    if lead.email.lower() in suppressed_emails:
        block("ye email suppression list me hai (bounce/unsubscribe/complaint)")
    if _count_links(full) > MAX_LINKS:
        block(f"links {_count_links(full)} hain, max {MAX_LINKS} allowed hai")
    if any(s in lower for s in SHORTENERS):
        block("URL shortener hai — poora link likho")
    if "attachment" in lower and "no attachment" not in lower:
        # (scaffold note: asal me attachment ka pata queue item se chalega)
        pass
    if _count_words(body) > MAX_WORDS:
        block(f"body {_count_words(body)} words hai, max {MAX_WORDS} hai")
    if subject.isupper() and len(subject) > 10:
        block("subject ALL CAPS me hai")
    for w in TRIGGER_WORDS:
        if w in lower:
            block(f"spam trigger word hai: '{w}'")
            break
    if "unsubscribe" not in lower:
        block("unsubscribe line missing hai (CAN-SPAM rule)")
    if "postal" not in lower and "address" not in lower:
        warn("postal address placeholder nahi mila — footer check karo")

    # ---- WARN rules (user dekhe, faisla kare) ----
    if lead.grade in ("B", "C"):
        warn(f"lead Grade {lead.grade} hai — Grade A pehle bhejna behtar hai")
    if _count_words(body) > 100:
        warn("body 100+ words hai, chhota karo to behtar hai")

    if any(r.startswith("BLOCK") for r in reasons):
        result = "block"
    elif any(r.startswith("WARN") for r in reasons):
        result = "warn"
    else:
        result = "pass"
    return SpamResult(result=result, reasons=reasons, score=score)
