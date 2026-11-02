-- ============================================================
-- Lumina migration 0002 — per-account OAuth tokens
-- ("Connect with Microsoft" dashboard flow + auto-refresh)
-- ============================================================
-- Idempotent: safe to run twice.
--
-- Design note (documented tradeoff): tokens live in these columns,
-- encrypted at rest by Supabase and protected by the existing
-- lumina_owner_all RLS policy (owner-only). This is the pragmatic
-- Phase-1 approach for a single-operator dashboard. Moving secrets
-- to Supabase Vault is tracked as future hardening.
-- Backward compat: accounts without DB tokens keep working via
-- token_ref (env var name) exactly as before.

ALTER TABLE sending_accounts
  ADD COLUMN IF NOT EXISTS oauth_access_token  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS oauth_refresh_token text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS oauth_expires_at    timestamptz,
  ADD COLUMN IF NOT EXISTS oauth_scope         text NOT NULL DEFAULT '';

-- Verification (run after applying):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='sending_accounts'
--   AND column_name IN ('oauth_access_token','oauth_refresh_token',
--                       'oauth_expires_at','oauth_scope');
-- must return 4 rows.
