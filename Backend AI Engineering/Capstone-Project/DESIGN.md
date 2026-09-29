# FlyRank Capstone — System Design

[← README](./README.md) · [Testing](./TESTING.md) · [Evidence](./EVIDENCE.md) · [Build log](./BUILDLOG.md)

This is the living design document. It started as the Phase 1 one-pager and has been kept in sync with what actually got built through Stage 14 — where a later stage changed a decision made here, that's called out explicitly rather than silently edited over.

## 1. Problem

An embeddable widget and lead-capture platform. A customer creates a widget, receives a JavaScript `<script>` snippet, and places it on an external website they own. When a visitor submits the widget:

1. The submission is sent to the public API from whatever origin the widget is embedded on.
2. The API validates the request — shape, size, and (where the widget defines fields) required fields and email format.
3. The API applies abuse protection: per-IP and per-widget rate limiting, plus a honeypot check.
4. The submission is stored, scoped to the correct widget and tenant.
5. The visitor's IP is enriched with geographic data through a two-provider fallback chain.
6. A background job performs a confirmation-email side effect, off the request path.
7. The customer views submissions and aggregate stats through the dashboard.

## 2. System Components

### 2.1 Backend API — Node.js + Express 5

Layered: routes → middleware → module (service + repository) → PostgreSQL. Routes never contain SQL; repositories never contain business logic. See §11.

### 2.2 PostgreSQL

Tenants, users, widgets, submissions, sessions, background jobs. Raw `pg`, no ORM — deliberate, so every tenant-scoped query visibly carries `WHERE tenant_id = $1` rather than hiding it behind an abstraction. Migrations via `node-pg-migrate`; there is no longer a static `schema.sql` (Stage 2 converted the original one-shot schema into a migration).

### 2.3 Frontend Dashboard — React + Vite

Authenticated: log in, manage widgets, view the embed snippet, view submissions (filterable, paginated), view overview stats and a geo breakdown.

### 2.4 Embeddable Widget — vanilla JavaScript

Loads the public config, renders an accessible form (native `required`/`type="email"` validation, a hidden honeypot field, a live status region), and submits cross-origin to the public API. Zero runtime dependencies; bundled with esbuild into a single immutable, versioned file.

### 2.5 Test Site

A plain HTML page served on a second local origin (`localhost:5500` vs the API's `localhost:3000`), used to prove the embed and submission flow actually crosses origins in a real browser, not just in test harness `fetch` calls.

## 3. Why two frontends

The dashboard and the widget are both "frontend," but they have opposite constraints, so they're built differently on purpose:

| | Dashboard | Widget |
|---|---|---|
| Runs on | The platform's own origin, in the owner's authenticated session | A stranger's website, embedded via `<script>` |
| Framework | React — normal, the owner already accepts the platform's UI | None — forcing a React runtime onto a customer's page just to render a form is the "widget that loads slowly is a widget customers remove" problem the brief warns about |
| Auth | Cookie session + CSRF | None — public, unauthenticated by design |

## 4. Embed Flow

```
Customer creates widget (authenticated)
        ↓
Backend stores widget, tenant-scoped
        ↓
Backend generates the embed snippet (bundle URL + config URL + widget ID)
        ↓
Customer pastes <script> into their website
        ↓
Browser loads widget.js (immutable, versioned, cached forever)
        ↓
Widget fetches /widgets/:id/config (public, cached 60s)
        ↓
Widget renders an accessible form + hidden honeypot
        ↓
Visitor submits
        ↓
POST /api/submissions (cross-origin, CORS + CORP headers set)
   ↓ rate limit (IP + widget) → 429 if exceeded
   ↓ payload validation → 400 with field-level details if invalid
   ↓ honeypot check → flagged as spam, never rejected outright
   ↓ idempotency check → same key returns the original row, no duplicate
   ↓ stored
   ↓ geo enrichment (best-effort, never blocks the response)
   ↓ confirmation-email job enqueued (skipped for spam)
        ↓
Dashboard shows the submission and updated stats
```

## 5. Database Model

Six tables: `tenants`, `users`, `widgets`, `submissions`, `sessions`, `jobs`. Full column list and indexes are in `backend/src/db/migrations/`; the shape is unchanged from the original design except where noted below.

**Widget `config` is now schema-validated, not an open JSON blob.** Stage 14 constrained it to `{ title?: string, fields?: [{ name, label, type: "text"|"email"|"textarea", required? }] }`, enforced with Zod at the API boundary. This exists because payload validation (§9) needs to know what fields a widget expects; an unconstrained config had no way to express that.

## 6. Tenant Isolation

Unchanged from the original design. Every customer-owned resource belongs to a tenant, and every query scopes on both the resource ID and the authenticated user's `tenant_id`:

```sql
SELECT * FROM widgets WHERE id = $1 AND tenant_id = $2;
SELECT * FROM submissions WHERE id = $1 AND tenant_id = $2;
```

Cross-tenant reads and writes return **404**, not 403 — this confirms the resource doesn't exist *for this tenant* without confirming it exists at all, which is the stronger privacy property. Verified in `widgetIsolation.test.js`, `dashboard.test.js`, and manually in TESTING.md §6.

## 7. API Surface

### Authentication

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Rate-limited (§10) |
| `POST` | `/api/auth/login` | Public | Rate-limited (§10) |
| `POST` | `/api/auth/logout` | Session + CSRF | |
| `GET` | `/api/auth/me` | Session | |

### Widget Management — session + CSRF required on all mutations

`GET /api/widgets`, `POST /api/widgets`, `GET /api/widgets/:id`, `PATCH /api/widgets/:id`, `DELETE /api/widgets/:id`, `GET /api/widgets/:id/embed`.

### Public Widget Delivery — no auth, CORS + CORP open

`GET /widgets/:id/config` — cached 60s, `stale-while-revalidate=300`.
`GET /widget/v:version/widget.js` — cached 1 year, `immutable`. Each `BUNDLE_VERSION` is built into its own `widget/dist/v{N}/` folder, so an old version stays servable after a new one ships (see §12 for why this matters).

### Public Submissions — no auth, CORS + CORP open

`OPTIONS /api/submissions`, `POST /api/submissions`.

### Dashboard — session + CSRF required

`GET /api/dashboard/overview`, `GET /api/dashboard/submissions` (filters: `widgetId`, `includeSpam`, `limit`, `offset`), `GET /api/dashboard/widgets/:id/stats`, `GET /api/dashboard/geo`.

## 8. Auth & Session Security

- Passwords hashed with bcrypt (cost 12), never returned in any response, never logged.
- **Session regeneration on both signup and login** — `req.session.regenerate()` runs before the session is populated, closing session fixation on the privilege-escalation moment (anonymous → authenticated), not just on login. This was a real gap caught mid-build (signup was missed on the first pass — see BUILDLOG.md) and fixed before it shipped.
- **CSRF: double-submit token**, added at Stage 11.5 after review flagged that `sameSite: lax` alone wasn't a complete defense. A random token is issued alongside the session on signup/login, stored server-side in `req.session.csrfToken` and client-side in a non-`httpOnly` `csrf_token` cookie. Every authenticated mutation (`POST`/`PATCH`/`DELETE` on `/api/widgets/*`, and `POST /api/auth/logout`) requires the token echoed back in an `X-CSRF-Token` header; a missing or mismatched token is a 403. Public routes (`/api/submissions`, widget delivery) carry no session cookie at all, so CSRF doesn't apply to them.
- **Login and signup are rate-limited together**, per IP (`RATE_LIMIT_AUTH_MAX`, default 20 per 15 minutes) — closed at Stage 14 after review found login had no brute-force protection at all.
- Session cookie: `httpOnly`, `sameSite: lax`, `secure` tied to `NODE_ENV=production` (was hardcoded `false` until Stage 14).
- Signup does leak whether an email is already registered (409 vs 201) — an accepted trade-off at this scope, not an oversight; see BUILDLOG.md.

## 9. Submission Validation

Payload validation runs in three layers (`submissionValidation.js`), added at Stage 14 after review found the original submission endpoint accepted any JSON object, including `{}`:

1. **Shape — every widget.** At most 30 fields, each a scalar (string/number/boolean), keys matching a safe pattern, string values capped at 5000 chars and trimmed. A payload where every value is blank is rejected outright.
2. **Fields — widgets with `config.fields` set.** Required fields enforced by name; `type: "email"` fields checked against an email pattern; any key not in the widget's field list is silently dropped before storage.
3. **Default widgets (no `config.fields`).** Only layer 1 applies, plus: if a field named `email` is present, it must look like an email. Nothing is required by name.

**Why the three-tier split, not one strict rule for everyone:** widgets created from the dashboard today have `config: {}` — the widget draws a default name/email/message form client-side, but the server was never told those fields exist. Making "name" and "email" mandatory server-side for every widget would have broken every existing test and every widget that predates this validator. The honest fix is to eventually materialize the default fields into `config.fields` at creation time so every widget gets full server-side enforcement; that's flagged as a follow-up, not silently glossed over.

Every rejection returns `400` with `{"error": "...", "details": [{"field": "...", "message": "..."}]}` — never a 500, and never a vague "invalid input."

## 10. Abuse Protection

- **Rate limiting** — per IP (default 100/min) and per widget (default 20/min), independent budgets, both wired into `POST /api/submissions`. A flood on one widget doesn't throttle a different widget's legitimate traffic (proven in `abuseProtection.test.js` and TESTING.md §12).
- **Honeypot** — a hidden `website` field the widget renders off-screen (`clip: rect(0 0 0 0)`, not `display:none`, so some bots that skip hidden fields still fill it). A filled honeypot flags the submission `spam: true` with a reason, but returns the identical `201` response a clean submission gets — the bot is never told it was caught. Spam rows are stored (so nothing is silently lost) but excluded from dashboard counts by default and never get a confirmation-email job.
- **Malformed JSON runs ahead of the rate limiters.** `express.json()` is mounted globally, before the submissions router; a request with syntactically broken JSON never reaches the per-route limiters. This is a documented limitation, not a fix — see README's "Known limitations."

## 11. Backend Layering

Unchanged: `HTTP Request → Routes → Middleware → Module (service + repository) → PostgreSQL`. Routes hold no SQL; middleware holds cross-cutting concerns (auth, CORS, CSRF, rate limiting, validation, error handling); modules hold business logic; repositories hold parameterized queries.

## 12. Geo Enrichment

Two providers, tried in order — provider A (ip-api.com), then provider B (ipapi.co) on failure, then no geo data if both fail. The submission is stored regardless.

**Provider modes, added at Stage 14.** Each provider now runs in one of `live | mock | down`, set independently via `GEO_PROVIDER_A_MODE` / `GEO_PROVIDER_B_MODE`. This exists because the original design ("mock one provider, toggle the other off") couldn't actually be *demonstrated* against the running system from a local machine — a private/loopback IP has no real location, so "provider A answers, B is skipped" was untestable live. `mock` mode returns a fixed, distinguishable result per provider (so you can tell from the stored `geo_provider` column which one actually answered), while automated tests always force both providers to `down` regardless of `.env`, keeping the suite hermetic and offline. See TESTING.md §13 for the full live walkthrough of all three states.

## 13. Idempotency

Unchanged. A unique index on `(widget_id, idempotency_key)` where the key is non-null; a retried request with the same key returns the original row instead of erroring or duplicating. Verified with an actual `COUNT(*)` against the table, not just a status-code check.

## 14. Background Jobs

Unchanged in structure: a PostgreSQL-backed `jobs` table, claimed with `SELECT ... FOR UPDATE SKIP LOCKED` so multiple workers can't double-process a row, exponential-ish backoff (`attempts * 5` seconds) up to `max_attempts`, then marked permanently `failed` with `failure_alerted_at` stamped.

**Forcing a failure for demo/testing, added at Stage 14.** `EMAIL_FORCE_FAIL=true` makes the confirmation-email handler always throw, so Probe 5 ("a failing side effect must not fail the submission") can be shown against the live system rather than only asserted in a unit test. Automated tests never see this flag — `env.js` forces it off under `NODE_ENV=test`.

## 15. Frontend Routes

| Path | Access | Page |
|---|---|---|
| `/login`, `/signup` | Public-only (redirects away if already authenticated) | Auth forms |
| `/dashboard` | Protected | Overview: stat cards + geo breakdown |
| `/dashboard/widgets` | Protected | List, empty state |
| `/dashboard/widgets/new`, `/dashboard/widgets/:id/edit` | Protected | Create/edit form |
| `/dashboard/widgets/:id` | Protected | Detail: embed snippet, copy button, delete |
| `/dashboard/submissions` | Protected | Filterable (widget, include-spam), paginated table |

Auth state is a three-value machine (`loading | authenticated | unauthenticated`), not a boolean — this avoids a flash-redirect to `/login` before the session cookie has actually been checked against the server.

## 16. Error Handling

A single error-handling middleware, tightened at Stage 14:

- Every error response is JSON, including unmatched routes (`404 {"error": "Not found"}`) and malformed JSON bodies (`400 {"error": "Malformed JSON in request body"}`) — nothing falls through to Express's default HTML error page.
- Only `5xx` errors are logged server-side; expected `4xx` client errors (validation failures, 401s, 404s) are not treated as failures in the logs.
- `/health` returns `503`, not `500`, when the database is unreachable — a `503` is the correct signal that the service is temporarily down, not broken.

## 17. Explicit Non-Goals

Unchanged from the original design, and still true at Stage 14:

- A full drag-and-drop form builder
- A real production CDN (bundle versions are retained locally as long as they were built, but there's no CDN, edge cache, or purge story)
- Customer domain management
- Production-scale distributed queues (the Postgres-backed queue is correct at this scale, not at high volume)
- Advanced CAPTCHA infrastructure
- Production hosting infrastructure

New, added during the hardening pass:

- A seed script for demo data (README's "Known limitations")
- Full server-side field enforcement for default (no-`config.fields`) widgets (§9)
- Shadow DOM style isolation for the embedded widget

The goal throughout stayed the same: prove the complete backend architecture and the full embeddable-widget flow, not build a production SaaS company.