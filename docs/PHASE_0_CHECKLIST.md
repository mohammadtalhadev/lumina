# Phase 0 Checklist — Graph Proof Gate

**Phase 0 kya hai:** Asli campaign se pehle ek chhota live test — system waqai
Microsoft Graph se email bhej sakta hai aur reply pakar sakta hai ya nahi.
Ye gate pass kiye baghair Phase 1 (Launch mode) shuru nahi hoga.

**Deploy:** Vercel services (web + worker, ek project). Dono live hain aur
binding verify ho chuki hai (2026-10-31).

---

## Step 1 — Supabase: migration ✅ DONE (2026-10-31)

`0001_lumina_core.sql` run ho chuki. Verification counts: **1, 5, 19** ✅

## Step 2 — Vercel env vars: baqi 2 add karo (subah, ~5 min)

Vercel → project → **Settings → Environment Variables** me ye 2 add karo
(baqi 6 pehle se set hain):

| Variable | Value |
|---|---|
| `CRON_SECRET` | `<CRON_SECRET-chat-me-diya-tha>` |
| `GRAPH_TOKEN_ACC1` | Step 3 ka Azure access token (neeche) |

⚠️ `WORKER_URL` kabhi manually mat set karna — binding inject karti hai.
Add karne ke baad **Redeploy** dabana lazmi hai.

## Step 3 — Azure: app registration (subah, ~10 min)

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
3. **Grant admin consent** dabao (personal Outlook account par direct consent mil jata hai).
4. OAuth Authorization Code flow se **access token** lo
   (scope: `Mail.Send Mail.ReadWrite`). Ye token `GRAPH_TOKEN_ACC1` me jayega
   (Step 2). Token ki expiry hoti hai — proof ke liye fresh token kaafi hai;
   refresh-token wiring Phase 1 me hogi.
   
   Credentials kabhi chat me nahi — token seedha Vercel dashboard me paste karo.

## Step 4 — cron-job.org: 15-min poll (subah, ~5 min)

1. cron-job.org → free account → **Create cronjob** → Title: `Lumina reply poll`
2. URL: `https://lumina-ten-pearl-47.vercel.app/api/cron/poll`
3. Method: **GET** · Schedule: **Every 15 minutes**
4. Advanced → Request headers: `Authorization: Bearer <CRON_SECRET-chat-me-diya-tha>`
   (CRON_SECRET wali value — baghair iske 401 aayega)

## Step 5 — Proof loop (1 test lead, assistant ke saath)

Jab Steps 2–4 done hon, mujhe batao. Phir:

1. Dashboard me 1 test lead daalo (tumhara apna doosra email),
2. Main send worker trigger karunga → Graph se 1 email jayega (tumhare Outlook se),
3. Tum us email ka **reply** karoge,
4. Agle 15-min poll me reply pakra jayega → `/replies` me nazar aayega + alert email aayega.

**Pass criteria:** email pahuncha + reply detect hua + alert aaya.
Iske baad Phase 0 **PASS** → Phase 1 Launch mode (5 leads/day, first 100 human-approved).

---

## Status (2026-10-31 ~03:30 PKT)

- [x] Vercel deploy (web + worker, binding verified live)
- [x] Supabase migration + verification (1, 5, 19)
- [x] Worker proxy + poll end-to-end test
- [ ] CRON_SECRET + GRAPH_TOKEN_ACC1 in Vercel env + redeploy
- [ ] cron-job.org 15-min job
- [ ] Phase 0 proof loop
