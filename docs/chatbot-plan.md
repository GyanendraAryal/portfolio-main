# Chatbot Plan — AI Resume Chatbot

> Status: **COMPLETE — implementation merged, build passing**

---

## 0. LangGraph Python vs JS/TS decision

**Decision: Python `langgraph` package.**

Rationale: the backend is already Django (Python 3.13, Render). Running LangGraph in Python means the agent lives in the same Django process (or a Django management command), shares the existing Postgres connection and ORM, and avoids a second runtime. The JS/TS `@langchain/langgraph` package would require a separate Node service, cross-origin calls, and duplicated secret management. No part of the plan below changes because of this; the earlier architecture assumed Python all along.

---

## 1. Data-model audit — extend, don't duplicate

### 1a. Existing `Resume` model (already in `portfolio/models.py`)

```python
class Resume(models.Model):
    title        = models.CharField(max_length=200, default='Resume')
    content      = models.BinaryField()        # raw PDF bytes
    file_url     = models.URLField(max_length=500)
    public_id    = models.CharField(max_length=300)
    created_at   = models.DateTimeField(auto_now_add=True)
    is_active    = models.BooleanField(default=True)
```

This already stores the resume bytes in Postgres. **No new `resumes` table is needed.**

Two fields must be added to extend the existing model:

| New field | Type | Purpose |
|---|---|---|
| `content_hash` | `CharField(max_length=64, blank=True, default='')` | SHA-256 of the normalised resume content; computed on save; blank for legacy rows |
| `updated_at` | `DateTimeField(auto_now=True)` | Tracks when content last changed (distinct from `created_at`) |

`content_hash` is the canonical version identifier used throughout the indexing pipeline.

### 1b. New models to add (in `portfolio/models.py`)

#### `ResumeIndexState`
Single-row control table (enforced by a `Meta.db_table` check, not a constraint — the worker simply upserts row with `pk=1`).

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField (PK) | always row 1 |
| `active_version` | `CharField(max_length=64, blank=True)` | content_hash of version currently live in Qdrant |
| `status` | `CharField(choices=['idle','indexing','failed'])` | current pipeline status |
| `last_indexed_at` | `DateTimeField(null=True)` | when the last successful index completed |
| `last_error` | `TextField(blank=True)` | last failure message |

#### `ResumeIndexJob` (outbox table)

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField (PK) | |
| `content_hash` | `CharField(max_length=64)` | links to the Resume row by hash |
| `status` | `CharField(choices=['pending','running','done','failed'])` | |
| `attempts` | `PositiveSmallIntegerField(default=0)` | |
| `created_at` | `DateTimeField(auto_now_add=True)` | |
| `last_error` | `TextField(blank=True)` | |

---

## 2. Migration order

| # | File | What it does |
|---|---|---|
| `0005_resume_add_hash_and_updated_at.py` | `AddField` — adds `content_hash` and `updated_at` to `portfolio_resume` |
| `0006_resumeindexstate_resumeindexjob.py` | `CreateModel` for `ResumeIndexState` and `ResumeIndexJob` |
| `0007_resume_index_safety_trigger.py` | `RunSQL` — installs the Postgres safety-net trigger (see §3) |

All three are in the `portfolio` app. No other apps need migrations for this feature.

---

## 3. Postgres safety-net trigger (migration 0007)

### What it does

Fires `AFTER INSERT OR UPDATE OF content` on `portfolio_resume`. If the new `content` is non-null and the new `is_active` is true, it:

1. Computes nothing itself (hash computation stays in Python to keep SQL simple).
2. Inserts a `pending` row into `portfolio_resumeindexjob` with the `content_hash` value already written to the row by the app's `save()` method.
3. Does **nothing else** — no HTTP calls, no `pg_notify`, no foreign function calls, no writes to any other table.

### Why it's safe

- Pure DML: `INSERT INTO portfolio_resumeindexjob ... SELECT NEW.content_hash ...`.
- No `PERFORM` / `pg_net` / `http_post` or any extension call.
- Idempotent guard: inserts only when `NEW.content_hash NOT IN (SELECT content_hash FROM portfolio_resumeindexjob WHERE status IN ('pending','running'))` — avoids duplicate jobs for the same hash.
- Runs inside the same transaction as the `UPDATE`/`INSERT` that triggered it, so the outbox row is always committed atomically with the resume row.

### Migration snippet (not code yet — prose description)

`RunSQL` forward SQL: `CREATE OR REPLACE FUNCTION resume_outbox_trigger_fn() ...` + `CREATE TRIGGER resume_outbox_trigger AFTER INSERT OR UPDATE OF content ON portfolio_resume FOR EACH ROW EXECUTE FUNCTION resume_outbox_trigger_fn();`

`RunSQL` reverse SQL: `DROP TRIGGER IF EXISTS resume_outbox_trigger ON portfolio_resume; DROP FUNCTION IF EXISTS resume_outbox_trigger_fn;`

---

## 4. Resume save path — wrapping in `transaction.atomic()`

### Where saves happen (found in the codebase)

There are **three** save paths:

| Path | File | Method |
|---|---|---|
| REST API upload | `portfolio/views.py` | `ResumeUploadView.post()` — calls `Resume.objects.create(...)` |
| Django Admin (new record) | `portfolio/admin.py` | `ResumeAdmin.save_model()` → `super().save_model()` → `instance.save()` |
| Django Admin (edit existing) | `portfolio/admin.py` | Same `save_model` path |

### Proposed wrapping

All three paths will be wrapped in `transaction.atomic()`. Inside the atomic block:

1. Compute `SHA-256(content)` and set `resume.content_hash`.
2. Save the `Resume` row (which also triggers the Postgres safety-net trigger inside the same transaction).
3. Insert a `ResumeIndexJob(content_hash=..., status='pending')` row **from Python** as well (belt-and-suspenders; the trigger is the fallback).

The Python outbox insert and the trigger fire in the same transaction, so if the transaction rolls back, neither the resume row nor the job row is committed.

### Optional `on_commit` hook

After the atomic block commits, `transaction.on_commit(lambda: call_command('index_resume', '--now'))` can kick the worker immediately. This is **optional and additive** — the scheduled fallback works without it. If the immediate kick fails (e.g. the management command raises), the scheduler picks it up within its next interval.

---

## 5. Worker — management command + Render cron

### Deployment host: Render

The backend is on **Render** (confirmed: `ALLOWED_HOSTS` defaults contain `personalwebsite-i8vv.onrender.com`; README deploy section targets Render; no Vercel serverless functions exist for the backend). Only the React/Vite **frontend** is deployed on Vercel.

### Worker design

A Django management command: `backend/portfolio/management/commands/index_resume.py`

Claim step:
```python
job = ResumeIndexJob.objects.select_for_update(skip_locked=True)\
          .filter(status='pending')\
          .order_by('created_at')\
          .first()
```

Processing steps (in order):
1. Set `job.status = 'running'`; save.
2. Load `Resume` by `content_hash = job.content_hash`. If `ResumeIndexState.active_version == job.content_hash`, mark done and exit (already indexed).
3. Chunk, embed (HF Inference API), upsert into Qdrant with deterministic point IDs (`sha256(content_hash + section + str(index))`), each point carrying `resumeVersion` in its payload.
4. In one `transaction.atomic()`: set `ResumeIndexState.active_version = job.content_hash`, `status = 'idle'`, `last_indexed_at = now()`; mark `job.status = 'done'`.
5. Delete old-version Qdrant points (filter `resumeVersion != new_hash`). Invalidate app-side response cache entries keyed to the old version hash.
6. On failure: increment `job.attempts`; store `job.last_error`; if `attempts >= 5` set `job.status = 'failed'` and `ResumeIndexState.status = 'failed'`; otherwise reset to `pending`.

### Cron trigger on Render

Render offers **Cron Jobs** as a first-class resource (paid plans; also works on the free-tier Starter if the repo declares it in `render.yaml`). Two options:

**Option A — Render Cron Job**
Add a cron job entry to `render.yaml` that runs `python manage.py index_resume` on a `* * * * *` schedule.

Limits on the **free tier**:
- The web service spins down after 15 minutes of inactivity. A cron job is a separate Render service, but it also cold-starts if the dyno has been sleeping. Cold start adds 30–60 s before the command runs, meaning a resume upload could sit unindexed for up to ~2 minutes after the cron fires.
- No hard timeout on management commands (unlike Vercel's 10 s/60 s limits).
- Render free cron jobs are available but reliability during cold starts is lower than paid tiers.

**Option B — Vercel Cron (not recommended)**
Vercel Hobby plan minimum interval is **once per day** — far too infrequent. Not viable.

**Option C — External cron → protected Django view (recommended for free tier)**
A free external cron service (e.g. [cron-job.org](https://cron-job.org)) POSTs to `https://your-backend.onrender.com/api/cron/resume-index` with an `Authorization: Bearer <CRON_SECRET>` header every minute.

- Works on Render free tier — the HTTP request also wakes the dyno, so the service stays warmer.
- The Django `CronResumeIndexView` validates `CRON_SECRET` and runs the same logic as the management command.
- No `render.yaml` cron configuration needed.
- Limit: depends on cron-job.org SLA (free tier is generally reliable, not guaranteed).

**Recommendation: Option C** (cron-job.org → `CronResumeIndexView`) on the free tier. It wakes the dyno as a side effect and requires no paid plan. If you upgrade to Render Starter ($7/mo), switch to Option A for tighter coupling.

---

## 6. LangGraph Python — impact on the plan

Using the Python `langgraph` package instead of the JS version changes the following:

| Concern | Impact |
|---|---|
| Where the graph runs | Inside the Django process (or the management command), not a separate Node.js service. |
| Dependency management | `langgraph`, `langchain-core`, `langchain-groq`, `huggingface_hub`, `qdrant-client` are added to `requirements.txt`. |
| API surface | The chat endpoint is a **Django REST Framework view** (`POST /api/chat/`) that invokes the graph synchronously or via async Django (ASGI). No separate Node service, no cross-origin hop. |
| Streaming | Backend runs WSGI (sync Gunicorn worker). SSE requires async and is not compatible. **Streaming approach: chunked transfer encoding** via Django's `StreamingHttpResponse` with a sync generator. LangGraph's synchronous `.stream()` iterator feeds the generator token-by-token. The client consumes the response as a readable stream (`fetch` + `ReadableStream`). No ASGI migration required. |
| State persistence | LangGraph's `MemorySaver` (in-process) for per-session state across turns. On Render the process stays alive (no cold-start state loss between turns), unlike serverless. This is a concrete advantage over Vercel functions. |
| Rate limiting | Counters stored in Postgres (same DB, no Redis needed on free tier). Upstash Redis is optional for speed but not required. |
| No decisions change | The node graph, edge-case handling, Qdrant vector store, HF embeddings, Groq LLM, outbox pattern, and migration design are all unchanged. |

---

## 7. Architecture diagram

```
Browser (React + Vite, Vercel)
  │
  │  POST /api/chat/  (chunked transfer, sync streaming)
  ▼
Django REST Framework  (Render — WSGI/Gunicorn, free tier)
  │
  ├─ ChatView
  │    └─ LangGraph agent (in-process, Python)
  │         ├─ validate_input
  │         ├─ classify_intent
  │         ├─ retrieve  ──────────────────────► Qdrant Cloud
  │         ├─ grade_context
  │         ├─ generate  ──────────────────────► Groq API  (gpt-oss-120b)
  │         └─ postprocess
  │
  ├─ ResumeUploadView / ResumeAdmin
  │    └─ transaction.atomic()
  │         ├─ Resume.save()  (content + content_hash)
  │         └─ ResumeIndexJob.insert(pending)   ◄─── also fired by PG trigger
  │
  └─ index_resume management command  (Render Cron, every 1 min)
       ├─ SELECT FOR UPDATE SKIP LOCKED
       ├─ HF Inference API  (embeddings)
       ├─ Qdrant upsert
       └─ ResumeIndexState.update(active_version)

PostgreSQL (Neon / Supabase / Railway)
  ├─ portfolio_resume          (content BinaryField + content_hash + updated_at)
  ├─ portfolio_resumeindexstate
  └─ portfolio_resumeindexjob
```

---

## 8. LangGraph node graph

```
[START]
   │
   ▼
validate_input ──(invalid)──► [refuse / truncate]
   │ (valid)
   ▼
classify_intent
   ├──(off-topic / sensitive / hostile)──► [canned response]
   ├──(greeting)──────────────────────────► [welcome reply]
   └──(resume question / unknown)
          │
          ▼
       retrieve  (Qdrant, top-k 5, filter: resumeVersion = active_version)
          │
          ▼
       grade_context
          ├──(below threshold)──► [not-in-resume response]
          └──(sufficient)
                 │
                 ▼
              generate  (Groq, strict system prompt)
                 │
                 ▼
              postprocess
                 │
                 ▼
              [stream to client]
```

---

## 9. New and changed files

```
backend/
  portfolio/
    models.py                          CHANGED — add content_hash, updated_at, ResumeIndexState, ResumeIndexJob
    views.py                           CHANGED — ResumeUploadView wrapped in transaction.atomic(); add ChatView, CronResumeIndexView
    admin.py                           CHANGED — ResumeAdmin.save_model wrapped in transaction.atomic()
    serializers.py                     CHANGED — ChatSerializer (message, sessionId)
    urls.py                            CHANGED — add /chat/, /cron/resume-index/, /index-status/
    migrations/
      0005_resume_add_hash_and_updated_at.py   NEW
      0006_resumeindexstate_resumeindexjob.py  NEW
      0007_resume_index_safety_trigger.py      NEW
    management/
      __init__.py                      NEW
      commands/
        __init__.py                    NEW
        index_resume.py                NEW — worker management command
    chatbot/
      __init__.py                      NEW
      graph.py                         NEW — LangGraph agent definition
      nodes.py                         NEW — validate_input, classify_intent, retrieve, grade_context, generate, postprocess
      prompts.py                       NEW — system prompt (stable prefix for provider-side caching)
      chunker.py                       NEW — resume section chunker
      embedder.py                      NEW — HF Inference API wrapper + embedding cache
      qdrant_client.py                 NEW — Qdrant upsert / query / delete helpers
      cache.py                         NEW — app-side response cache (Postgres-backed or in-memory LRU)
      rate_limiter.py                  NEW — per-visitor rate limiting (Postgres counters)
  requirements.txt                     CHANGED — add langgraph, langchain-core, langchain-groq,
                                                  huggingface_hub, qdrant-client, hashlib (stdlib)

client/
  src/
    components/
      ChatWidget/
        ChatWidget.jsx                 NEW — floating launcher + panel
        ChatPanel.jsx                  NEW — message list, input, controls
        ChatMessage.jsx                NEW — streamed text, markdown-safe, copy button
        TypingIndicator.jsx            NEW — animated dots
        SuggestedQuestions.jsx         NEW — welcome-state quick questions
    context/
      ChatContext.jsx                  NEW — chat state (same pattern as ThemeContext)
    hooks/
      useChat.js                       NEW — guard-clause hook
    api/
      chat.js                          NEW — fetch wrapper for POST /api/chat/ (chunked ReadableStream, no SSE)

docs/
  chatbot-plan.md                      THIS FILE

scripts/
  ingest.py                            NEW — full re-index CLI script (calls index_resume command)

evals/
  resume-qa.json                       NEW — 20+ golden questions

render.yaml                            NEW (or updated) — cron job entry for index_resume
.env.example (backend)                 CHANGED — see §10
```

---

## 10. Environment variables

### Backend (`backend/.env.example`) — additions

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq LLM API key |
| `HF_API_TOKEN` | Hugging Face Inference API token (free tier) |
| `QDRANT_URL` | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Qdrant Cloud API key |
| `QDRANT_COLLECTION` | Collection name (e.g. `resume_chunks`) |
| `CRON_SECRET` | Bearer token checked by `CronResumeIndexView`; also used if calling the endpoint from an external cron |
| `CHAT_RATE_LIMIT_DAILY` | Max messages per visitor per 24 h rolling window (default: `15`) |
| `CHAT_RATE_LIMIT_BURST` | Max messages per visitor per minute (default: `5`) |
| `VISITOR_HASH_SECRET` | Server-side secret for hashing client IPs (never logged raw) |
| `RESPONSE_CACHE_TTL` | App-side response cache TTL in seconds (default: `3600`) |

### Frontend (`client/.env.example`) — additions

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Already present; no change needed |

No new frontend env vars are required — all secrets stay server-side.

---

## 11. Resolved decisions (all open questions answered)

| # | Question | Answer | Impact on plan |
|---|---|---|---|
| 1 | Render plan tier | **Free** | Cron via Option C (cron-job.org → `CronResumeIndexView`). Cold starts mean up to ~2 min indexing lag. |
| 2 | WSGI vs ASGI | **WSGI (sync Gunicorn)** | Streaming via `StreamingHttpResponse` + sync generator. No SSE, no ASGI migration needed. |
| 3 | Qdrant collection | **Fresh start** | Plan includes Qdrant Cloud setup steps, collection creation with `all-MiniLM-L6-v2` vector size (384 dims, cosine distance). |
| 4 | Groq model ID | **Confirmed: `openai/gpt-oss-120b`** | Valid current production model on Groq. 131K context, 65K max completion, 1K RPM, $0.15/$0.60 per 1M tokens. |
| 5 | PDF parsing | **`pypdf` at index time, no extra JSON field** | Worker extracts text from `Resume.content` bytes in memory. Raw binary stays as-is. `pypdf` added to `requirements.txt`. |

No open questions remain. The plan is ready for approval.
