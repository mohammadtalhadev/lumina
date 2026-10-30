"""
config.py — saari settings ek jagah se.

Simple me: ye file .env se secrets parhti hai taake keys code me
hard-code na hon. `pydantic-settings` khud check karta hai ke
zaroori values mojood hain ya nahi — agar koi missing ho to
app start hote hi saaf error dega (adhoori config par chalne ke bajaye).

Seekhne ke liye: ye "12-factor app" ka usool hai — config hamesha
environment se aaye, code se nahi.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # .env file se parho; extra vars ignore karo
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_key: str

    # Self-email alerts is personal email par jayenge (user choice)
    alert_email: str = ""

    # Safety: ek run me max kitne emails bhej sakta hai worker
    # (galti se poori queue khaali na ho jaye)
    # Vercel Hobby par serverless timeout 60s hai — 10 sends (~20-30s + cold
    # start) har run ko safe margin me rakhta hai. Baqi queue agli run me
    # drain hoti hai (idempotent — double-send ka khatra nahi).
    max_sends_per_run: int = 10

    # Retry: fail hone par kitni dafa dobara try kare, kitne gap par (minutes)
    max_attempts: int = 3
    retry_backoff_minutes: tuple[int, ...] = (5, 15, 45)


settings = Settings()
