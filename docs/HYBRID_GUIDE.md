# Hybrid Guide — har cheez kya hai, kyun hai, kaise kaam karti hai

Ye guide is liye hai taake tum sirf code na chalao, samjho bhi.
Har section: **kya hai → real-life example → Lumina me kahan hai → kaise chalaya**.

---

## 1. Supabase — ghar (data + auth + security)

**Kya hai:** Ek managed backend — matlab database (PostgreSQL), login system
(Auth), security rules (RLS), live updates (Realtime) aur secrets ka locker
(Vault), sab ek jagah, tumhein server khareedne ya maintain karne ki zaroorat nahi.

**Real-life example:** Bank jaisa. Tum paise (data) bank me rakhte ho,
bank khud tijori, guard (auth), aur register (logs) sambhalta hai.
Tumhein apni tijori nahi banani parti.

**Lumina me kahan:** `supabase/migrations/0001_lumina_core.sql` — saari tables.
Python is se `app/db.py` ke zariye baat karta hai.

**Terms:**
- **Table** = Excel sheet jaisi, lekin powerful (leads, send_queue...)
- **Row** = ek line (ek lead), **Column** = ek field (email)
- **RLS (Row Level Security)** = rule ke kaunsi row kaun dekh sakta hai.
  Hamari policy: sirf logged-in owner sab dekh sakta hai.
- **Migration** = database me change karne wali script, number ke sath
  (0001, 0002...), taake tarteeb kabhi na toote. Hamari migration
  idempotent hai — dobara chalao to kuch duplicate nahi banega.

---

## 2. FastAPI — waiter (API layer)

**Kya hai:** Python ka framework jo HTTP requests sunta hai aur jawab deta hai.
Tum browser me URL kholo → FastAPI ka function chalta hai → JSON jawab milta hai.

**Real-life example:** Restaurant ka waiter. Tum (client) menu (URL) se order
dete ho, waiter (FastAPI) kitchen (workers/database) tak baat pahunchata hai
aur khana (data) wapas lata hai. Tum kitchen me khud nahi jate.

**Lumina me kahan:** `worker/app/main.py`
- `GET /health` → "zinda hun?"
- `GET /queue` → queue me kya pending hai
- `POST /workers/send/run` → send worker ka ek chakkar abhi chalao
- `/docs` kholo to automatic API documentation milti hai (FastAPI khud banata hai!)

**Term:**
- **Endpoint** = ek URL + method (GET/POST) = ek kaam
- **Decorator** (`@app.get(...)`) = function ke upar wali line jo kehti hai
  "ye function is URL par chalega"

---

## 3. Worker — kitchen staff (background kaam)

**Kya hai:** Aisa program jo insaan ke click ka wait nahi karta — khud
schedule par ya trigger par chalta hai aur bhari kaam karta hai.

**Real-life example:** Kitchen staff. Waiter order le aata hai, lekin khana
peeche staff banata hai — tumhein nazar nahi aata, lekin uske baghair
restaurant nahi chal sakta.

**Lumina me 3 workers** (`worker/app/workers/`):
| Worker | Kaam | Kab chalta hai |
|---|---|---|
| `send_worker` | Queue se email bhejo (spam check + rotation + audit) | Har 10-15 min, ya `/workers/send/run` se |
| `poll_worker` | Inbox check karo, replies pakro, stage update karo | Har 15 min per account (staggered) |
| `health_worker` | Rozana checkup: score, auto-pause, cap suggest | Roz ek dafa |

**Term:**
- **Polling** = baar baar poochna "kuch naya?" (mailbox roz check karna)
- **Cron job** = time par khud chalne wala kaam (alarm ki tarah)
- **Idempotency** = dobara chalne par bhi double kaam na ho
  (ek email do dafa na jaye — `idempotency_key` se)

---

## 4. Queue — token wali line

**Kya hai:** Kaam ki line. Email seedha nahi bheja jata — pehle line me
lagta hai (`send_queue` table), phir worker bari bari nikalta hai.

**Real-life example:** Bank me token. Sab line me lagte hain, counter wala
ek ek karke bulata hai. Koi line tor kar aage nahi aa sakta — isi tarah
gap aur cap ki pabandi queue se hoti hai, yaad se nahi.

**Lumina me:** `send_queue` table + `send_worker.py`. Har item par
`scheduled_at` (kab bhejna hai) aur `status` (queued/sending/sent/
failed/blocked/cancelled) hota hai.

---

## 5. Rotation — bari ka nizam

**Kya hai:** Bohat se accounts me se har email ke liye best account chunna.

**Real-life example:** Cricket me bowling rotation — jo bowler fresh aur
fit hai, usko over do. Thaka hua bowler bahar bithao.

**Lumina me:** `worker/app/services/rotation.py`
1. **Eligibility** (hard rules): status=ready? cap bacha? 12-min gap poora?
2. **Pick**: sab se zyada health score; tie ho to jis ne aaj kam bheja.

---

## 6. Spam check — darwaza

**Kya hai:** Bhejne se pehle automatic checklist. Fail = email ruk gaya.

**Lumina me:** `worker/app/services/spamcheck.py` — pure function, is liye
iske 10 tests hain (`tests/test_spamcheck.py`).

---

## 7. Health score — doctor ki report

**Kya hai:** Numbers (bounce, placement, complaints) se ek 0-100 score,
aur us se faisla: ready / cooling / paused.

**Lumina me:** `worker/app/services/health.py`. Hard breach
(bounce >5%, spam >0.3%) par foran auto-pause — score ka wait nahi.

---

## 8. Microsoft Graph — Outlook ka remote

**Kya hai:** Microsoft ki API — code se email bhejo/inbox parho.
Password nahi, OAuth token jata hai har request me.

**Lumina me:** `worker/app/services/graph.py` — `GraphClient(token)`.
Token har account ka alag, `.env` me (scaffold) ya Vault me (production).

---

## 9. .env aur venv — chabiyan aur kamra

- **.env**: secrets ki file (keys, tokens). Git me KABHI nahi jayegi.
  `.env.example` sirf khaaka hai.
- **venv** (`.venv/`): Python ka alag kamra — is project ki libraries
  sirf yahin hain, system Python saaf rehta hai. Yehi professional tareeqa hai.

---

## 10. Tests — khud se sawal

**Kya hai:** Code se poochna "sahi jawab doge?" Aur check karna.
`pytest` chalao → 18 passed = 18 daawe sahi nikle.

**Lumina me:** `worker/tests/` — rotation ke 8, spamcheck ke 10 tests.
Rule: logic badlo to pehle test chalao. Green = aage barho.

---

## Kaise chalana hai (commands)

```bash
cd ~/workspace/lumina/worker

# 1. Tests (hamesha pehle)
.venv/bin/pytest -q

# 2. API server (dusre terminal me)
cp .env.example .env   # phir .env me apni values bharo
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... .venv/bin/uvicorn app.main:app --reload
# kholo: http://127.0.0.1:8000/docs

# 3. Worker ka ek chakkar (bina server ke bhi)
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... .venv/bin/python -c "
from app.db import SupabaseDB
from app.workers import send_worker
print(send_worker.run_once(SupabaseDB()))"
```

## Agle steps (Phase 0 — tumhara hissa, password kabhi nahi)

1. Supabase project banao (tum khud, apne account se) → `0001_lumina_core.sql`
   SQL Editor me chalao → verification queries se confirm karo.
2. `.env` me `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` bharo.
3. Azure app + Outlook OAuth — tum khud live browser me login karoge,
   token `.env` me `GRAPH_TOKEN_ACC1` ke tor par aayega.
4. Phir: `POST /workers/send/run` se pehla test lead ka loop chalao.
