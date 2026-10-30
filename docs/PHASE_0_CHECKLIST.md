# Phase 0 Checklist — Graph Proof Gate

**Phase 0 kya hai:** Asli campaign se pehle ek chhota live test — system waqai
Microsoft Graph se email bhej sakta hai aur reply pakar sakta hai ya nahi.
Ye gate pass kiye baghair Phase 1 (dashboard + Launch mode) shuru nahi hoga.

**Waqt:** ~15–20 min tumhara (Supabase + Azure tumhare accounts me hota hai —
credentials kabhi chat me nahi aayenge).

---

## Step 1 — Supabase: migration run karo

1. Supabase dashboard kholo → apna project (`nymnmmbpgjlglbrbpvyq`) → **SQL Editor**.
2. Is repo ki file kholo: `supabase/migrations/0001_lumina_core.sql`
3. Poora content copy karke SQL Editor me paste karo → **Run**.
4. Ye migration **idempotent** hai — ghalti se dobara run ho jaye to koi nuksan nahi.

## Step 2 — Verification queries (copy-paste, ek ek karke Run)

```sql
SELECT count(*) FROM brand_config;
-- lazmi jawab: 1

SELECT count(*) FROM campaign_templates;
-- lazmi jawab: 5

SELECT count(*) FROM pg_policies WHERE policyname = 'lumina_owner_all';
-- lazmi jawab: 19
```

Teeno jawab **1, 5, 19** aane chahiye. Ye teen numbers mujhe bhejo —
yehi Phase 0 ka pehla proof hai.

## Step 3 — Azure: app registration (Outlook sending ke liye)

1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** →
   **App registrations** → **New registration**.
   - Name: `Lumina` (koi bhi naam chalega)
   - Supported account types: *Accounts in any organizational directory and
     personal Microsoft accounts*
   - Redirect URI: `https://localhost` (proof ke liye kaafi)
2. App khulne par **API permissions** → **Add a permission** → **Microsoft Graph**
   → **Delegated permissions** → ye dono select karo:
   - `Mail.Send`
   - `Mail.ReadWrite`
3. **Grant admin consent** dabao (agar button disabled hai to tenant admin chahiye —
   personal Outlook account par ye step nahi hota, direct consent mil jata hai).
4. **Certificates & secrets** → **New client secret** → value copy karo
   (sirf ek dafa nazar aayegi — apne paas mehfooz rakho, chat me kabhi nahi).
5. OAuth flow se **access token** lo (Authorization Code flow, scope:
   `Mail.Send Mail.ReadWrite`). Ye token `GRAPH_TOKEN_ACC1` me jayega.
   Token ki expiry hoti hai — Phase 0 proof ke liye fresh token kaafi hai;
   refresh-token wiring Phase 1 me hogi.

## Step 4 — Worker `.env`

```bash
cd ~/workspace/lumina/worker
cp .env.example .env
```

`.env` me ye bharo (apne editor me — chat me kabhi nahi):

| Variable | Kahan se milegi |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Wahi page → `service_role` key (secret!) |
| `GRAPH_TOKEN_ACC1` | Step 3 ka access token |
| `ALERT_EMAIL` | Tumhara apna email (alerts yahin aayenge) |

`.env` kabhi git me commit nahi hogi (`.gitignore` me hai).

## Step 5 — Proof loop (1 test lead)

Jab Steps 1–4 done hon, mujhe batao. Phir main worker chalakar:

1. `leads` me 1 test lead daalunga (tumhara apna doosra email — taake reply tum khud bhej sako),
2. send worker se 1 email bhejunga (Graph se, tumhare Outlook account se),
3. tum us email ka **reply** karoge,
4. poll worker reply pakrega → `replies` table me row + dashboard alert + tumhe self-email.

**Pass criteria:** email pahuncha + reply detect hua + alert aaya.
Iske baad Phase 0 **PASS** → Phase 1 (Next.js dashboard + Launch mode 5 leads/day).

---

## Mujhe kya bhejna hai

- [ ] Verification ke teen numbers: `1, 5, 19` (ya jo bhi aaye)
- [ ] "Azure app ready" (token .env me lag gaya)
- [ ] Test lead ka email (jis par test email jaye)

Phir proof loop main chalaunga.
