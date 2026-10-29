# Lumina Supabase

## Migration chalana

1. Supabase dashboard → apna project → SQL Editor → New query
2. `migrations/0001_lumina_core.sql` ka poora content paste karo → Run
3. Dobara chalana safe hai (idempotent) — kuch duplicate nahi banega

## Verify (SQL Editor me)

```sql
SELECT count(*) FROM brand_config;          -- 1 hona chahiye
SELECT count(*) FROM campaign_templates;   -- 5 hone chahiye
SELECT count(*) FROM pg_policies WHERE policyname = 'lumina_owner_all';  -- 19
```

## Order

- `0001_lumina_core.sql` — sab core tables + RLS + seed. Is se pehle kuch nahi.
