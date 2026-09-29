# Evidence

[← README](./README.md) · [Design](./DESIGN.md) · [Testing](./TESTING.md) · [Build log](./BUILDLOG.md)

One row per requirement from the capstone brief (Section 6) and the shared cross-capstone requirements (Section 8). Each row points at the specific proof in [TESTING.md](./TESTING.md) rather than repeating the transcript here — this file is the index, TESTING.md is where the actual output lives.

## Widget Management

| Requirement | Status | Proof |
|---|---|---|
| Authenticated CRUD endpoints for widgets; requests without valid auth are rejected | ✅ | TESTING §0 (401 on all widget/dashboard routes without a session), §4–§5 (full create/read/update/delete cycle, all authenticated); `widgetIsolation.test.js` (10 tests) |
| Multi-tenant isolation proven: tenant A cannot read or modify tenant B's widgets or submissions | ✅ | TESTING §6 (Tenant B gets 404 on read/edit/delete/embed of Tenant A's widget, empty results from dashboard queries scoped to Tenant A's widget ID); Screenshots #19, #20; `widgetIsolation.test.js`, `dashboard.test.js` |

## Widget Delivery

| Requirement | Status | Proof |
|---|---|---|
| Embed snippet generated per widget | ✅ | TESTING §4 (widget creation returns a widget; `/embed` returns the real `<script>` tag); Screenshot #6 |
| Public config endpoint serves a small payload with correct HTTP cache headers | ✅ | TESTING §7 — `Cache-Control: public, max-age=60, stale-while-revalidate=300` on `/widgets/:id/config` |
| Widget JavaScript served as a versioned bundle (new version = new URL or cache-bust) | ✅ | TESTING §7 — `/widget/v1/widget.js`, `Cache-Control: public, max-age=31536000, immutable`; DESIGN.md §7 explains the per-version folder structure that keeps an old version servable after a new one ships |
| The widget renders on a page served from a different origin than your API | ✅ | Screenshot #9 — real embed snippet rendered on `localhost:5500` against an API on `localhost:3000` |

## Public Submission API

| Requirement | Status | Proof |
|---|---|---|
| Cross-origin submissions work: CORS headers correct, preflight (`OPTIONS`) handled | ✅ | TESTING §8 (curl), Screenshots #12–#13 (DevTools Network tab on a real browser request — this is the case that a curl-only test can't fully cover, since only a real browser enforces CORS/CORP); `submissionSubmit.test.js` |
| All incoming input validated; malformed and oversized payloads rejected with appropriate 4xx codes and JSON errors | ✅ | TESTING §9 — 8 distinct invalid-input cases, all clean 4xx with structured `details`, never a 500; Screenshot #10 (client-side `required` validation as a first line of defense); `hardening.test.js` (14 tests) |
| Valid submissions stored safely, linked to the right widget and tenant | ✅ | TESTING §8–§9 (every stored submission's response includes the correct `widgetId`); §6 confirms tenant scoping holds on read-back |

## Abuse Protection

| Requirement | Status | Proof |
|---|---|---|
| Rate limiting per IP and/or per widget returns 429 under a burst — and the API keeps serving legitimate traffic | ✅ | TESTING §12 — 20 of 25 rapid requests to one widget succeed then 429, while a different widget's request in the middle of the burst succeeds normally; Screenshot #18 (same proof from the browser, via the real widget form); `abuseProtection.test.js` |
| At least one spam-prevention technique demonstrably blocks a spam submission | ✅ | TESTING §11 — honeypot field, flagged `spam: true` server-side, excluded from the confirmation-email job, but returns an identical `201` to a clean submission so a bot learns nothing; Screenshots #14–#16 |

## Enrichment & Safe Side Effects

| Requirement | Status | Proof |
|---|---|---|
| IP→geo enrichment uses a provider fallback chain: provider A down → provider B answers → submission enriched | ✅ | TESTING §13 — all three states (A answers, A down/B answers, both down) demonstrated live against the running system via provider modes (DESIGN.md §12); `enrichmentAndJobs.test.js`, `hardening.test.js` |
| All providers down → submission still succeeds (without geo). Degrade, never fail | ✅ | TESTING §13, third case — `HTTP 201`, `geo_provider` and `country_code` both empty, submission fully stored |
| A failing confirmation email/webhook does not prevent the submission from being stored | ✅ | TESTING §14 — `EMAIL_FORCE_FAIL=true` makes the handler genuinely throw; submission still returns 201 and is stored; job retries 3 times with backoff, then marked `failed` with `failure_alerted_at` set; `hardening.test.js` |

## Documentation

| Requirement | Status | Proof |
|---|---|---|
| README with architecture diagram, setup instructions, and API documentation | ✅ | [README.md](./README.md) (setup, stack, layout), [DESIGN.md](./DESIGN.md) §4 (embed flow diagram), §7 (full API surface) |
| Required submission-pack files present | ✅ | `README.md`, `DESIGN.md`, `EVIDENCE.md`, `BUILDLOG.md`, `.env.example`, `capstone.yaml` all present at the repo root |

## Shared Cross-Capstone Requirements

| # | Requirement | Status | Proof |
|---|---|---|---|
| 1 | Layered architecture — data / logic / HTTP separated | ✅ | DESIGN.md §11 — routes hold no SQL, repositories hold only parameterized queries, services hold business logic. Structure visible directly in `backend/src/{routes,modules,middleware}` |
| 2 | Validation at the boundary — bad input → clean 4xx, never a 500 | ✅ | TESTING §9 (8 cases), §2 (4 signup-validation cases including the original 130-char-name bug that used to 500 — see BUILDLOG.md); `hardening.test.js` |
| 3 | ≥1 background job — slow/bulk work off the request path, retries + failure alert | ✅ | TESTING §14 — confirmation-email job runs off the request path, retries 3× with backoff, sets `failure_alerted_at` on permanent failure; DESIGN.md §14 |
| 4 | Real persistence — schema as migrations, right indexes, isolated tenants | ✅ | `backend/src/db/migrations/` (not a static `schema.sql` — converted at Stage 2); indexes on every tenant-scoped and lookup column (see the migration file); TESTING §6 for isolation proof |
| 5 | Idempotency where it matters — the retried action happens once | ✅ | TESTING §10 — a retried submission with the same idempotency key returns the identical row, verified with `COUNT(*) = 1`, not inferred |
| 6 | Secrets clean — env only, encrypted if stored, never logged | ✅ | All secrets (`DATABASE_URL`, `SESSION_SECRET`) load through `config/env.js` only, which throws at startup if either is missing; `.env` is git-ignored with `.env.example` committed instead; passwords are bcrypt-hashed and never appear in any response or log line |
| 7 | Cost tracked, if AI is used — per call, attributed, with a budget guard | N/A | No AI/LLM calls are made anywhere in this system — the "AI" in the capstone menu refers to a different track. Nothing to track. |

## Honest gaps (not silently omitted)

Three things fall outside what's demonstrated above, on purpose — documented rather than hidden:

- **No seed script.** A fresh clone needs a widget created manually through the dashboard before `test-site/index.html` has anything to point at. See README's "Known limitations."
- **Default widgets get looser server-side validation than widgets with a configured field list.** DESIGN.md §9 explains the three-tier validation design and why full enforcement for default widgets is a follow-up, not a current guarantee.
- **Malformed-JSON floods bypass the rate limiters**, because `express.json()` parses (and can reject) the body before the per-route limiter middleware runs. Documented in DESIGN.md §10 and README's "Known limitations."