"""
conftest.py — test env setup.

Worker modules (db, config) import-time par SUPABASE_* env mangte hain.
Real tests inhe use nahi karte (fake DB / mocked HTTP), is liye yahan
dummy values set hain — taake import fail na ho. Koi real connection
kabhi nahi banta.
"""
import os

os.environ.setdefault("SUPABASE_URL", "http://test.local")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
