"""
Tests — spamcheck.py ke liye.

Har BLOCK rule ka ek test: rule toro, check karo ke result 'block' aaya
aur wajah me us rule ka zikr hai. Yehi "boundary testing" hai —
had par khare ho kar dekho ke darwaza band hota hai ya nahi.
"""
from app.models import Lead
from app.services import spamcheck

GOOD_SUBJECT = "Quick idea for BrightSmile Dental"
GOOD_BODY = (
    "Hi Sarah, I noticed your clinic has no online booking — "
    "patients have to call. We build booking websites for dental clinics "
    "in 21 days. Worth a 15-min chat?\n\n"
    "Unsubscribe: reply STOP. Postal address: 123 Main St, Austin TX"
)


def make_lead(**kw):
    base = dict(id="l1", email="sarah@brightsmile.com", contact_name="Sarah",
                company="BrightSmile", grade="A", email_verified=True)
    base.update(kw)
    return Lead(**base)


def test_good_email_passes():
    r = spamcheck.check_email(GOOD_SUBJECT, GOOD_BODY, make_lead(), set())
    assert r.result == "pass", r.reasons


def test_unverified_lead_blocked():
    r = spamcheck.check_email(GOOD_SUBJECT, GOOD_BODY,
                              make_lead(email_verified=False), set())
    assert r.result == "block"
    assert any("verified" in x for x in r.reasons)


def test_suppressed_email_blocked():
    r = spamcheck.check_email(GOOD_SUBJECT, GOOD_BODY, make_lead(),
                              {"sarah@brightsmile.com"})
    assert r.result == "block"
    assert any("suppression" in x for x in r.reasons)


def test_two_links_blocked():
    body = GOOD_BODY + " https://example.com https://other.com"
    r = spamcheck.check_email(GOOD_SUBJECT, body, make_lead(), set())
    assert r.result == "block"


def test_shortener_blocked():
    body = GOOD_BODY + " https://bit.ly/abc123"
    r = spamcheck.check_email(GOOD_SUBJECT, body, make_lead(), set())
    assert r.result == "block"


def test_long_body_blocked():
    body = "word " * 121 + "\nUnsubscribe: reply STOP. 123 Main St"
    r = spamcheck.check_email(GOOD_SUBJECT, body, make_lead(), set())
    assert r.result == "block"


def test_all_caps_subject_blocked():
    r = spamcheck.check_email("AMAZING OFFER FOR YOUR CLINIC TODAY",
                              GOOD_BODY, make_lead(), set())
    assert r.result == "block"


def test_trigger_word_blocked():
    r = spamcheck.check_email(GOOD_SUBJECT,
                              GOOD_BODY + " Guaranteed 100% profit!",
                              make_lead(), set())
    assert r.result == "block"


def test_missing_unsubscribe_blocked():
    body = "Hi Sarah, quick idea for your clinic. 123 Main St, Austin TX"
    r = spamcheck.check_email(GOOD_SUBJECT, body, make_lead(), set())
    assert r.result == "block"
    assert any("unsubscribe" in x for x in r.reasons)


def test_grade_c_gives_warn_not_block():
    r = spamcheck.check_email(GOOD_SUBJECT, GOOD_BODY,
                              make_lead(grade="C"), set())
    assert r.result == "warn"  # rukega nahi, lekin user ko warning dikhegi
