-- ============================================================
-- LUMINA v2 — 0001 core schema
-- Purpose: creates every table the Lumina v2 blueprint needs
--          (Section 5 data model + Section 14 v2.1 additions).
-- Idempotent: safe to run many times. Every CREATE is guarded
--          (IF NOT EXISTS / DO block) and every seed INSERT uses
--          ON CONFLICT DO NOTHING.
-- How to prove it worked: run the verification queries at the
--          bottom — all of them must return rows / true.
-- Order: this is file 0001, run it before any later migration.
-- ============================================================

-- ---------- helper: updated_at auto-touch ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'lumina_touch_updated_at') THEN
    CREATE OR REPLACE FUNCTION lumina_touch_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$
    LANGUAGE plpgsql;
  END IF;
END $$;

-- ---------- brand_config (single row, id = 1) ----------
CREATE TABLE IF NOT EXISTS brand_config (
  id            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  agency_name   text NOT NULL DEFAULT 'TBD',
  founder_name  text NOT NULL DEFAULT 'TBD',
  postal_address text NOT NULL DEFAULT 'TBD',
  cal_link      text NOT NULL DEFAULT 'TBD',
  linkedin_headline text NOT NULL DEFAULT 'TBD',
  alert_email   text NOT NULL DEFAULT 'TBD',  -- self-email alerts go here
  send_window_tz text NOT NULL DEFAULT 'Asia/Karachi',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- campaigns (niche = DATA, never hard-coded) ----------
CREATE TABLE IF NOT EXISTS campaigns (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  niche                    text NOT NULL DEFAULT 'general',
  icp_json                 jsonb NOT NULL DEFAULT '{}',
  offer_json               jsonb NOT NULL DEFAULT '{}',
  research_checklist_json  jsonb NOT NULL DEFAULT '[]',
  pain_taxonomy_json       jsonb NOT NULL DEFAULT '[]',
  grading_rules_json       jsonb NOT NULL DEFAULT '{}',
  enrichment_config_json   jsonb NOT NULL DEFAULT '{}',
  discovery_questions_json jsonb NOT NULL DEFAULT '[]',
  proposal_template_json   jsonb NOT NULL DEFAULT '{}',
  onboarding_template_json jsonb NOT NULL DEFAULT '[]',
  spam_rules_extra_json    jsonb NOT NULL DEFAULT '[]',
  sequence_gaps_json       jsonb NOT NULL DEFAULT '[0,3,7,12]',
  is_active                boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ---------- campaign_templates (preset library) ----------
CREATE TABLE IF NOT EXISTS campaign_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  niche         text NOT NULL,
  campaign_json jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_templates_niche_unique UNIQUE (niche)
);

-- ---------- leads ----------
CREATE TABLE IF NOT EXISTS leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  company          text NOT NULL DEFAULT '',
  contact_name     text NOT NULL DEFAULT '',
  email            text NOT NULL,
  grade            text NOT NULL DEFAULT 'C' CHECK (grade IN ('A','B','C')),
  stage            text NOT NULL DEFAULT 'New'
                   CHECK (stage IN ('New','Researched','Contacted','Replied','Call Booked',
                                    'Proposal Sent','Negotiation','Won','Lost','Disqualified','Suppressed')),
  pain_signals_json jsonb NOT NULL DEFAULT '[]',
  research_notes   text NOT NULL DEFAULT '',
  source           text NOT NULL DEFAULT 'manual',
  email_verified   boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_email_unique UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads(stage);
CREATE INDEX IF NOT EXISTS leads_campaign_idx ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS leads_grade_idx ON leads(grade);

-- ---------- sending_accounts ----------
CREATE TABLE IF NOT EXISTS sending_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label            text NOT NULL,
  email            text NOT NULL,
  provider         text NOT NULL DEFAULT 'outlook_personal'
                   CHECK (provider IN ('outlook_personal','m365_sending_domain')),
  token_ref        text NOT NULL DEFAULT '',  -- Vault ref (prod) or env var name (scaffold)
  status           text NOT NULL DEFAULT 'warming'
                   CHECK (status IN ('warming','ready','cooling','paused','disconnected','banned_risk')),
  warmup_day       integer NOT NULL DEFAULT 0,
  placement_score  integer NOT NULL DEFAULT 0 CHECK (placement_score BETWEEN 0 AND 100),
  daily_cap        integer NOT NULL DEFAULT 0,
  sent_today       integer NOT NULL DEFAULT 0,
  last_sent_at     timestamptz,
  health_score     integer NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  paused_reason    text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sending_accounts_email_unique UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS sending_accounts_status_idx ON sending_accounts(status);

-- ---------- send_queue (single source of truth for sending) ----------
CREATE TABLE IF NOT EXISTS send_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  account_id      uuid REFERENCES sending_accounts(id) ON DELETE SET NULL,
  campaign_id     uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  sequence_step   integer NOT NULL DEFAULT 0,
  subject         text NOT NULL DEFAULT '',
  body            text NOT NULL DEFAULT '',
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','sending','sent','failed','blocked','cancelled')),
  idempotency_key text NOT NULL,
  spam_check_result jsonb NOT NULL DEFAULT '{}',
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  sent_at         timestamptz,
  error           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT send_queue_idempotency_unique UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS send_queue_status_idx ON send_queue(status);
CREATE INDEX IF NOT EXISTS send_queue_due_idx ON send_queue(status, scheduled_at);

-- ---------- spam_checks ----------
CREATE TABLE IF NOT EXISTS spam_checks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id     uuid NOT NULL REFERENCES send_queue(id) ON DELETE CASCADE,
  result       text NOT NULL CHECK (result IN ('pass','warn','block')),
  blocked_reason text NOT NULL DEFAULT '',
  score        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- suppressions (GLOBAL — applies to every account) ----------
CREATE TABLE IF NOT EXISTS suppressions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  company      text NOT NULL DEFAULT '',
  reason       text NOT NULL CHECK (reason IN ('bounce','unsubscribe','complaint','not_interested','manual')),
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppressions_email_unique UNIQUE (email)
);

-- ---------- sequences ----------
CREATE TABLE IF NOT EXISTS sequences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_day    integer NOT NULL,
  template    text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sequences_campaign_step_unique UNIQUE (campaign_id, step_day)
);

-- ---------- sequence_emails (history of what actually went out) ----------
CREATE TABLE IF NOT EXISTS sequence_emails (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  step               integer NOT NULL,
  sent_via_account_id uuid REFERENCES sending_accounts(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'sent',
  sent_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------- sent_emails (immutable audit log — exact text sent) ----------
CREATE TABLE IF NOT EXISTS sent_emails (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id    uuid NOT NULL REFERENCES send_queue(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  account_id  uuid REFERENCES sending_accounts(id) ON DELETE SET NULL,
  to_email    text NOT NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  approved_by text NOT NULL DEFAULT 'owner',
  sent_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sent_emails_lead_idx ON sent_emails(lead_id);
CREATE INDEX IF NOT EXISTS sent_emails_account_day_idx ON sent_emails(account_id, sent_at);

-- ---------- replies ----------
CREATE TABLE IF NOT EXISTS replies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid REFERENCES leads(id) ON DELETE SET NULL,
  account_id          uuid REFERENCES sending_accounts(id) ON DELETE SET NULL,
  thread_id           text NOT NULL DEFAULT '',
  reply_from_account_id uuid REFERENCES sending_accounts(id) ON DELETE SET NULL, -- reply continuity
  classification      text NOT NULL DEFAULT 'unclassified'
                      CHECK (classification IN ('unclassified','positive','busy','price','not_interested',
                                                'referral','out_of_office','bounce','unsubscribe')),
  body_summary        text NOT NULL DEFAULT '',
  received_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS replies_lead_idx ON replies(lead_id);
CREATE INDEX IF NOT EXISTS replies_thread_idx ON replies(thread_id);

-- ---------- alerts (dashboard inbox + self-email outbox record) ----------
CREATE TABLE IF NOT EXISTS alerts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL DEFAULT 'info'
             CHECK (type IN ('info','positive_reply','warning','critical')),
  lead_id    uuid REFERENCES leads(id) ON DELETE SET NULL,
  account_id uuid REFERENCES sending_accounts(id) ON DELETE SET NULL,
  message    text NOT NULL,
  channel    text NOT NULL DEFAULT 'dashboard' CHECK (channel IN ('dashboard','self_email')),
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alerts_unread_idx ON alerts(is_read, created_at);

-- ---------- warmup_inboxes ----------
CREATE TABLE IF NOT EXISTS warmup_inboxes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES sending_accounts(id) ON DELETE CASCADE,
  placement_score integer NOT NULL DEFAULT 0 CHECK (placement_score BETWEEN 0 AND 100),
  checked_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- account_health_daily ----------
CREATE TABLE IF NOT EXISTS account_health_daily (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES sending_accounts(id) ON DELETE CASCADE,
  day             date NOT NULL DEFAULT CURRENT_DATE,
  sent            integer NOT NULL DEFAULT 0,
  bounces         integer NOT NULL DEFAULT 0,
  replies         integer NOT NULL DEFAULT 0,
  spam_complaints integer NOT NULL DEFAULT 0,
  health_score    integer NOT NULL DEFAULT 100,
  CONSTRAINT account_health_daily_unique UNIQUE (account_id, day)
);

-- ---------- calls ----------
CREATE TABLE IF NOT EXISTS calls (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  cal_booking_ref text NOT NULL DEFAULT '',
  notes_json     jsonb NOT NULL DEFAULT '{}',
  outcome        text NOT NULL DEFAULT 'scheduled'
                 CHECK (outcome IN ('scheduled','done','no_show','cancelled')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- proposals ----------
CREATE TABLE IF NOT EXISTS proposals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  amount     numeric(12,2) NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'draft'
             CHECK (status IN ('draft','sent','accepted','rejected')),
  sent_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- clients ----------
CREATE TABLE IF NOT EXISTS clients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                 uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  onboarding_checklist_json jsonb NOT NULL DEFAULT '[]',
  advance_paid            boolean NOT NULL DEFAULT false,
  advance_verified_at     timestamptz,
  advance_amount          numeric(12,2) NOT NULL DEFAULT 0,
  remaining_amount        numeric(12,2) NOT NULL DEFAULT 0,
  payment_method          text NOT NULL DEFAULT '' ,  -- payoneer / wise
  invoice_ref             text NOT NULL DEFAULT '',
  go_live_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---------- activities ----------
CREATE TABLE IF NOT EXISTS activities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid REFERENCES leads(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'note',
  note       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_lead_idx ON activities(lead_id);

-- ---------- RLS: on everywhere, single-owner permissive policies ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brand_config','campaigns','campaign_templates','leads','sending_accounts',
    'send_queue','spam_checks','suppressions','sequences','sequence_emails','sent_emails',
    'replies','alerts','warmup_inboxes','account_health_daily','calls','proposals','clients','activities']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'lumina_owner_all' AND tablename = t) THEN
      EXECUTE format('CREATE POLICY lumina_owner_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ---------- updated_at triggers ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brand_config','campaigns','leads','sending_accounts','send_queue','calls','proposals','clients']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'lumina_touch_' || t) THEN
      EXECUTE format('CREATE TRIGGER lumina_touch_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION lumina_touch_updated_at()', t, t);
    END IF;
  END LOOP;
END $$;

-- ---------- seed: brand row + blank template (never duplicates) ----------
INSERT INTO brand_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_templates (niche, name, campaign_json) VALUES
  ('blank', 'Blank campaign', '{"sequence_gaps":[0,3,7,12]}'::jsonb),
  ('dental', 'Dental clinics (preset)', '{"niche":"dental","sequence_gaps":[0,3,7,12]}'::jsonb),
  ('law', 'Law firms (preset)', '{"niche":"law","sequence_gaps":[0,3,7,12]}'::jsonb),
  ('shopify', 'Shopify DTC (preset)', '{"niche":"shopify","sequence_gaps":[0,3,7,12]}'::jsonb),
  ('hvac', 'HVAC (preset)', '{"niche":"hvac","sequence_gaps":[0,3,7,12]}'::jsonb)
ON CONFLICT (niche) DO NOTHING;

-- ============================================================
-- VERIFICATION (run after applying; every check must pass)
-- ============================================================
-- SELECT count(*) FROM brand_config;                       -- must be 1
-- SELECT count(*) FROM campaign_templates;                 -- must be 5
-- SELECT tablename FROM pg_tables
--   WHERE schemaname='public' AND tablename LIKE '%lumina%' OR tablename IN
--   ('brand_config','campaigns','leads','send_queue');      -- all present
-- SELECT count(*) FROM pg_policies WHERE policyname='lumina_owner_all'; -- 19
