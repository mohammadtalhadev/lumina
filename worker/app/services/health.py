"""
health.py — account ki sehat ka hisaab.

Simple me: har account ka roz score banta hai 0-100.
Bounce barhe to score girega, placement kharab ho to aur girega.
Score ke hisab se faisla:
  - 70+        → ready (sab theek)
  - 40-69      → cooling (volume kam, nazar rakho)
  - <40 ya hard breach → paused (insaan dekhega tabhi wapas aayega)

Hard breaches (foran pause, score se khel nahi):
  - 7 din me bounce rate > 5%
  - spam complaints > 0.3%
  - placement < 50%

Seekhne ke liye: ye "derived metric" hai — kacche numbers
(sent, bounce) se ek faisla-number banana. Dashboard yehi dikhayega.
"""
from __future__ import annotations


def compute_health(sent: int, bounces: int, replies: int,
                   spam_complaints: int, placement: int) -> tuple[int, str, str]:
    """
    Returns: (score 0-100, suggested_status, wajah)
    suggested_status: 'ready' | 'cooling' | 'paused'
    """
    # --- hard breaches: seedha pause ---
    if sent > 0:
        bounce_rate = bounces / sent * 100
        spam_rate = spam_complaints / sent * 100
        if bounce_rate > 5:
            return 20, "paused", f"bounce {bounce_rate:.1f}% > 5% (hard breach)"
        if spam_rate > 0.3:
            return 10, "paused", f"spam complaint {spam_rate:.2f}% > 0.3% (hard breach)"
    if placement < 50 and sent > 0:
        return 25, "paused", f"placement {placement}% < 50% (hard breach)"

    # --- score: 100 se shuru, kharabiyan minus ---
    score = 100
    reasons: list[str] = []
    if sent > 0:
        bounce_rate = bounces / sent * 100
        if bounce_rate > 2:
            score -= 20
            reasons.append(f"bounce {bounce_rate:.1f}% > 2%")
        elif bounce_rate > 1:
            score -= 10
            reasons.append(f"bounce {bounce_rate:.1f}% > 1%")
        if spam_complaints > 0:
            score -= 25
            reasons.append(f"{spam_complaints} spam complaint(s)")
    if placement < 85:
        score -= 30
        reasons.append(f"placement {placement}% < 85%")
    elif placement < 90:
        score -= 10
        reasons.append(f"placement {placement}% < 90% (aim)")
    if replies > 0:
        score = min(100, score + 5)  # replies sehat ki nishani hain

    score = max(0, min(100, score))
    if score >= 70:
        status = "ready"
    elif score >= 40:
        status = "cooling"
    else:
        status = "paused"
    wajah = "; ".join(reasons) if reasons else "sab theek"
    return score, status, wajah


def suggest_cap(account_age_days: int, placement: int,
                health_score: int) -> int:
    """
    Per-account ramp (v2 Section 6): umar + placement + health se
    aaj ka cap tajweez karo. Personal Outlook ka max 20/day.
    """
    if health_score < 40 or placement < 85:
        return 0  # pehle sehat theek karo, phir volume
    if account_age_days < 14:
        return 0  # warmup poora nahi
    if account_age_days < 21:
        return 5
    if account_age_days < 28:
        return 10
    return 20
