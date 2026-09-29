# Testing

[← README](./README.md) · [Design](./DESIGN.md) · [Evidence](./EVIDENCE.md) · [Build log](./BUILDLOG.md)

This document is the full test record: the automated suite, a manual terminal walkthrough covering every acceptance probe in the capstone brief, and a browser walkthrough with screenshots. [EVIDENCE.md](./EVIDENCE.md) maps each brief requirement to the specific section below rather than repeating it — this file is where the actual proof lives.

## Contents

- [1. Automated test suite](#1-automated-test-suite)
- [2. Manual walkthrough — setup](#2-manual-walkthrough--setup)
- [3. Manual walkthrough — terminal](#3-manual-walkthrough--terminal)
- [4. Browser walkthrough — screenshots](#4-browser-walkthrough--screenshots)

---

## 1. Automated test suite

```
cd backend
npm run test
```

**83 tests, 83 passing, 0 failures**, run serially (`--test-concurrency=1`, forced after an earlier run showed two test files silently stealing each other's background jobs from a shared queue — see BUILDLOG.md).

```
◇ injected env (18) from ../.env
✔ generic rate limiter returns 429 once the limit is exceeded (583.7ms)
✔ ip rate limiter keys by IP address (13.0ms)
✔ widget rate limiter keys by widgetId in the body, not by IP (10.3ms)
✔ a clean submission is stored with spam = false (25.7ms)
✔ a filled honeypot field is flagged as spam but still returns 201 (11.9ms)
✔ a whitespace-only honeypot field is not treated as spam (11.4ms)
✔ rate limiting is wired into the live submission endpoint (95.6ms)
✔ a different widget is unaffected while another widget is being rate limited (122.7ms)
◇ injected env (18) from ../.env
✔ unauthenticated request is rejected (971.9ms)
✔ overview counts exclude spam and reflect real submissions (29.2ms)
✔ tenant B sees zero widgets and zero submissions in their own overview (6.6ms)
✔ submissions list excludes spam by default (6.9ms)
✔ submissions list includes spam when includeSpam=true is passed (6.6ms)
✔ submissions list respects limit and offset (5.4ms)
✔ invalid query params return 400, not 500 (3.1ms)
✔ tenant B cannot see tenant A submissions even by passing tenant A's widgetId (24.1ms)
✔ widget stats for own widget returns totals (6.0ms)
✔ widget stats for another tenant's widget returns 404 (3.0ms)
✔ malformed widget id in stats route returns 400 (2.2ms)
✔ geo breakdown reflects only non-spam submissions with geo data (11.6ms)
◇ injected env (18) from ../.env
✔ provider A answering short-circuits provider B (516.7ms)
✔ provider A down falls back to provider B (0.2ms)
✔ both providers down returns null, not an error (0.1ms)
✔ no IP address returns null without calling either provider (0.2ms)
✔ a real submission enqueues a confirmation job that completes (20.1ms)
✔ a spam-flagged submission never queues a confirmation job (5.6ms)
✔ a job with no registered handler fails permanently and sets failure_alerted_at (17.1ms)
✔ a job retries with backoff before eventually failing permanently (23.8ms)
✔ retrying the same idempotency key does not enqueue a second job (10.0ms)
◇ injected env (18) from ../.env
✔ malformed JSON body returns a clean 400 JSON error (529.1ms)
✔ oversized body returns 413 with a JSON error (4.0ms)
✔ unknown routes return a JSON 404 and do not advertise the framework (2.4ms)
✔ a nested object as a field value is rejected with field-level details (7.3ms)
✔ more than 30 fields is rejected (5.5ms)
✔ an empty payload is rejected (6.4ms)
✔ a payload of only whitespace values is rejected (6.3ms)
✔ an invalid email on a default widget is rejected (4.6ms)
✔ a widget with defined fields rejects a missing required field (3.7ms)
✔ a widget with defined fields rejects a malformed email (2.5ms)
✔ unknown keys are dropped, not stored, for widgets with defined fields (10.2ms)
✔ string values are trimmed before storing (6.5ms)
✔ widget config with an unknown field type is rejected (3.5ms)
✔ widget config with duplicate field names is rejected (16.2ms)
✔ provider A answering enriches the stored submission (mock-a) (6.8ms)
✔ provider A down: provider B enriches the stored submission (mock-b) (5.8ms)
✔ both providers down: submission is stored without geo data (5.8ms)
✔ isPrivateIp recognises loopback and private ranges only (0.4ms)
✔ live providers skip private addresses without any network call (0.2ms)
✔ a throwing confirmation email still returns 201, keeps the row, and recovers on retry (32.5ms)
✔ signup with a 130-character company name is a 400, not a 500 (2.1ms)
✔ signup with an empty company name is rejected (1.4ms)
✔ signup with an over-long password is rejected (1.4ms)
✔ signup with a malformed email is rejected (1.3ms)
✔ login attempts are rate limited per IP (36.3ms)
◇ injected env (18) from ../.env
✔ preflight OPTIONS request succeeds with CORS headers (524.3ms)
✔ cross-origin submission succeeds and returns 201 (11.1ms)
✔ submissions without an idempotency key each create a new row (15.1ms)
✔ different idempotency keys on the same widget create separate rows (12.7ms)
✔ same idempotency key retried returns the original submission, not a duplicate (16.0ms)
✔ malformed widgetId returns 400, not 500 (2.7ms)
✔ non-existent widget returns 404 (3.6ms)
✔ oversized payload returns 413, not 500 (4.1ms)
✔ submission from an inactive widget returns 404 (24.4ms)
◇ injected env (18) from ../.env
✔ public config endpoint works without authentication (527.0ms)
✔ public config endpoint returns correct cache headers (2.8ms)
✔ versioned widget bundle is publicly accessible (4.9ms)
✔ versioned widget bundle returns immutable cache headers (2.4ms)
✔ authenticated user receives the embed snippet (5.5ms)
✔ updating a widget changes its version but not the bundle URL (12.5ms)
✔ version 1 widget bundle is publicly accessible (2.5ms)
✔ invalid public widget ID returns 404 (1.5ms)
✔ non-existent widget config returns 404 (3.0ms)
✔ unknown bundle version returns 404 (1.4ms)
◇ injected env (18) from ../.env
✔ tenant A can create a widget (979.6ms)
✔ tenant A can list their widgets (6.4ms)
✔ tenant B cannot read tenant A widget (10.7ms)
✔ tenant B cannot edit tenant A widget (9.0ms)
✔ tenant A can edit their own widget (12.5ms)
✔ malformed widget ID returns 400 (2.9ms)
✔ unauthenticated user cannot access widgets (1.6ms)
✔ a request missing the CSRF token is rejected with 403 (5.5ms)
✔ a request with the wrong CSRF token is rejected with 403 (14.2ms)
✔ tenant A can delete their own widget (12.1ms)

ℹ tests 83
ℹ pass 83
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 7111.05
```

```
npm audit --omit=dev     # backend  → found 0 vulnerabilities
npm audit --omit=dev     # frontend → found 0 vulnerabilities
```

Test files: `abuseProtection.test.js`, `dashboard.test.js`, `enrichmentAndJobs.test.js`, `hardening.test.js`, `submissionSubmit.test.js`, `widgetDelivery.test.js`, `widgetIsolation.test.js`.

---

## 2. Manual walkthrough — setup

Full rebuild from a clean state, proving the README's run instructions actually work on their own:

```bash
docker compose down -v                  # containers, network, and the postgres volume
rm -rf widget/dist
docker compose up -d
docker compose ps                        # confirmed (healthy) before continuing

cd backend
npm run migrate:up                       # → Migrations complete!
npm run build:widget                     # → Widget bundle built: v1 -> .../widget/dist/v1/widget.js
```

Three terminals kept running for the walkthrough below: **T1** backend (`npm run dev` / `npm start` when an env override was needed), **T2** frontend, **T3** the test site on port 5500. All curl commands ran in a fourth terminal, with:

```bash
API=http://localhost:3000
CT="Content-Type: application/json"
dbq() { docker compose exec -T postgres psql -U widget_user -d widget_platform "$@"; }
```

---

## 3. Manual walkthrough — terminal

### §0 — Health check, unauthenticated access, DB outage

```
$ curl -s -w "\nHTTP %{http_code}\n" $API/health
{"status":"ok","database":"connected"}
HTTP 200

$ curl -s -w "\nHTTP %{http_code}\n" $API/api/auth/me
{"error":"Authentication required"}
HTTP 401
(same 401 for /api/widgets and /api/dashboard/overview)

$ docker compose stop postgres
$ curl -s -w "\nHTTP %{http_code}\n" --max-time 8 $API/health
{"error":"Service unavailable"}
HTTP 503

$ docker compose start postgres
$ curl -s -w "\nHTTP %{http_code}\n" $API/health
{"status":"ok","database":"connected"}
HTTP 200
```

**Proves:** health check works both ways; unauthenticated access to protected routes is uniformly 401; a DB outage degrades to a correct 503, not a 500 or a hang.

### §1 — Signup and cookie flags

```
$ curl -si -c /tmp/jarA.txt -X POST $API/api/auth/signup -H "$CT" \
  -d '{"tenantName":"Tenant A","email":"a@test.com","password":"password123"}'
HTTP/1.1 201 Created
Set-Cookie: csrf_token=0cf94e22...; Path=/; SameSite=Lax
Set-Cookie: connect.sid=s%3AjpMC0n...; Path=/; Expires=...; HttpOnly; SameSite=Lax
{"user":{"id":"b9606edd-...","email":"a@test.com"},"tenant":{"id":"8e213507-...","name":"Tenant A"}}

$ curl -s -w "\nHTTP %{http_code}\n" -b /tmp/jarA.txt $API/api/auth/me
{"user":{...}}
HTTP 200
```

**Proves:** signup returns two cookies — session (`HttpOnly`) and CSRF token (readable by JS, as it must be) — and the session works immediately after.

### §2 — Signup validation

```
tenantName too short field, password "abc"     → 400 "Too small: expected string to have >=8 characters"
email "not-an-email"                             → 400 "Invalid email address"
tenantName 130 chars (column is varchar(120))    → 400 "Too big: expected string to have <=120 characters"
tenantName "   " (whitespace only)               → 400 "Too small: expected string to have >=1 characters"
duplicate email                                  → 409 "Email is already registered"
```

**Proves:** the 500 that used to happen on an over-length company name (the original bug this hardening pass fixed) is now a clean 400 — see BUILDLOG.md.

### §3 — Login and session regeneration

```
wrong password                                   → 401 "Invalid email or password"
nonexistent email, wrong password                → 401 "Invalid email or password"   (identical message — no account enumeration)

$ curl -si -c /tmp/jarL.txt -X POST $API/api/auth/login -H "$CT" -d '{"email":"a@test.com","password":"password123"}'
HTTP/1.1 200 OK
Set-Cookie: connect.sid=s%3APaWNj1...

$ for f in /tmp/jarA.txt /tmp/jarL.txt; do grep connect.sid $f | awk '{print $NF}'; done
s%3AjpMC0nfXqEFYYlPCWqN4_Z8927rLMS_7...   ← from signup
s%3APaWNj1O2xiVY7F9qV5EliKp-gIkh8jaQ...   ← from login, different session ID
```

**Proves:** the session ID actually changes between signup and login for the same user — session regeneration is real, not decorative.

### §4 — CSRF and widget creation

```
POST /api/widgets, no X-CSRF-Token          → 403 "Invalid or missing CSRF token"
POST /api/widgets, X-CSRF-Token: wrong      → 403 "Invalid or missing CSRF token"
POST /api/widgets, correct token            → 201, widget created (Widget A)
POST /api/widgets, a widget with config.fields (email required, company optional)  → 201 (Strict Widget)
POST /api/widgets, a plain widget for the rate-limit test → 201 (Burst Widget)
```

**Proves:** CSRF is enforced on the success path too, not just rejected paths — the correct-token request genuinely succeeds.

### §5 — Widget validation and versioning

```
config.fields with type "checkbox" (not in enum)   → 400 "Invalid option: expected one of \"text\"|\"email\"|\"textarea\""
GET /api/widgets/not-a-uuid                          → 400 "Invalid UUID"
GET /api/widgets/<random uuid>                       → 404 "Widget not found"
PATCH /api/widgets/:id with {}                        → 400 "At least one field is required"
PATCH /api/widgets/:id with {"name": "..."}            → 200, version bumped 1 → 2
```

### §6 — Tenant B isolation

```
Tenant B, GET Widget A                       → 404
Tenant B, PATCH Widget A                     → 404
Tenant B, DELETE Widget A                    → 404
Tenant B, GET Widget A's embed               → 404
Tenant B, GET /api/widgets                   → {"widgets":[]}
Tenant B, GET /api/dashboard/submissions?widgetId=<A's id>   → {"submissions":[],"total":0}
Tenant B, GET /api/dashboard/widgets/<A's id>/stats           → 404

Tenant A, GET Widget A afterward             → still "Widget A (renamed)", untouched by any of the above attempts
```

Also checked the dashboard API is not openly cross-origin, unlike the public routes:

```
$ curl -si -H "Origin: http://evil.example" -b /tmp/jarA.txt $API/api/widgets | grep -iE '^(HTTP|access-control)'
HTTP/1.1 200 OK
                                    ← no Access-Control-* header at all
```

**Proves:** every cross-tenant attempt is a uniform 404, no leakage of existence, and the dashboard API doesn't advertise an open CORS policy the way public delivery routes intentionally do.

### §7 — Public delivery

```
GET /widgets/:id/config    → 200, Cache-Control: public, max-age=60, stale-while-revalidate=300
                              Access-Control-Allow-Origin: *,  Cross-Origin-Resource-Policy: cross-origin
GET /widget/v1/widget.js   → 200, Cache-Control: public, max-age=31536000, immutable
                              same CORS/CORP headers, Content-Type: text/javascript
GET /widget/v99999/widget.js → 404 "Widget bundle not found"
GET /widgets/not-a-uuid/config → 404 "Widget not found"
```

**Proves:** both headers a browser actually needs to load and read a cross-origin resource are present (CORS alone isn't enough — see BUILDLOG.md for how the CORP gap was found).

### §8 — Cross-origin preflight and submission (Probe 1)

```
$ curl -si -X OPTIONS $API/api/submissions -H "Origin: http://localhost:5500" \
  -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST,OPTIONS
Access-Control-Allow-Headers: Content-Type

$ curl -si -X POST $API/api/submissions -H "Origin: http://localhost:5500" -H "$CT" \
  -d '{"widgetId":"<Widget A>","payload":{"name":"Cross Origin","email":"xo@test.com"}}'
HTTP/1.1 201 Created
Cross-Origin-Resource-Policy: cross-origin
Access-Control-Allow-Origin: *
{"id":"81f7e645-...","widgetId":"f94b6120-...","createdAt":"..."}
```

### §9 — Malformed, invalid and oversized input (Probe 2)

Every case below returned a clean 4xx JSON body — **none of these was ever a 500**:

```
malformed JSON syntax                              → 400 "Malformed JSON in request body"
widgetId "nope" (not a UUID)                        → 400 "Invalid UUID"
widgetId = a real, non-existent UUID                → 404 "Widget not found"
payload as a plain string, not an object            → 400 "Invalid input: expected record, received string"
payload.name as a nested object                     → 400 "Must be text, a number, or true/false"
payload = {}                                        → 400 "Submission cannot be empty"
payload.email = "not-an-email" (default widget)     → 400 "Email must be a valid email address"
200,000-character field value                       → 413 "Request body is too large"

Strict Widget, missing required email               → 400 "Email is required"
Strict Widget, malformed email                       → 400 "Email must be a valid email address"
Strict Widget, valid email + company + an extra
  unexpected key "evil"                              → 201, and:

$ dbq -c "SELECT payload FROM submissions WHERE widget_id='<Strict Widget>';"
                   payload
---------------------------------------------
 {"email": "ok@test.com", "company": "Acme"}
```

**Proves:** the unknown `evil` key was silently dropped before storage, not stored, not rejected — exactly the layer-2 behavior DESIGN.md §9 describes.

### §10 — Idempotency

```
$ for i in 1 2; do curl -s -X POST $API/api/submissions -H "$CT" \
    -d '{"widgetId":"<A>","payload":{"email":"idem@test.com"},"idempotencyKey":"demo-key-1"}'; echo; done
{"id":"766d5165-...", ...}
{"id":"766d5165-...", ...}          ← identical id both times

$ dbq -c "SELECT count(*) FROM submissions WHERE idempotency_key='demo-key-1';"   → 1
$ dbq -c "SELECT count(*) FROM jobs j JOIN submissions s ON s.id=j.submission_id
          WHERE s.idempotency_key='demo-key-1';"                                  → 1
```

**Proves:** the retried request returns the original row, and only one DB row and one job were ever created — verified with an actual count, not inferred from the response alone.

### §11 — Honeypot (Probe 6)

```
$ curl -s -X POST $API/api/submissions -H "$CT" \
  -d '{"widgetId":"<A>","payload":{"name":"Bot","email":"bot@test.com"},"website":"http://spam.example.com"}'
{"id":"7c42873c-...", ...}          ← identical response shape to a clean submission
HTTP 201

$ dbq -c "SELECT spam, spam_reason FROM submissions WHERE payload->>'email'='bot@test.com';"
 spam |      spam_reason
------+-----------------------
 t    | honeypot_field_filled

$ dbq -c "SELECT count(*) FROM jobs j JOIN submissions s ON s.id=j.submission_id
          WHERE s.payload->>'email'='bot@test.com';"
 jobs_for_bot
--------------
            0
```

**Proves:** the bot got a 201 identical to a real submission (never tipped off), but the row is flagged `spam` and no confirmation job was queued for it.

### §12 — Rate limiting (Probe 3)

```
$ for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " -X POST $API/api/submissions -H "$CT" \
    -d "{\"widgetId\":\"<Burst Widget>\",\"payload\":{\"email\":\"burst$i@test.com\"}}"; done
201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 201 429 429 429 429 429

$ curl -s -X POST $API/api/submissions -H "$CT" -d '{"widgetId":"<Widget A>","payload":{"email":"after-burst@test.com"}}'
{"id":"7a6f0796-...", ...}
HTTP 201                          ← a DIFFERENT widget, unaffected by the burst above

$ curl -si -X POST $API/api/submissions -H "$CT" -d '{"widgetId":"<Burst Widget>", ...}'
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 20
RateLimit-Remaining: 0
Retry-After: 33
{"error":"Too many submissions for this widget, please slow down"}

$ sleep 61
$ curl -si -X POST $API/api/submissions -H "$CT" -d '{"widgetId":"<Burst Widget>", ...}'
HTTP/1.1 201 Created              ← window reset, traffic flows again
```

**Proves:** exactly 20 of 25 rapid requests succeeded (the configured limit), a burst on one widget did not affect a different widget, and the limit correctly resets after the window closes.

### §13 — Geo fallback chain (Probe 4)

Backend restarted three times with different provider modes (see DESIGN.md §12 for why modes exist):

```
GEO_PROVIDER_A_MODE=mock GEO_PROVIDER_B_MODE=mock
  → submission stored with geo_provider=mock-a, country_code=US, city=Mountain View

GEO_PROVIDER_A_MODE=down GEO_PROVIDER_B_MODE=mock
  → submission stored with geo_provider=mock-b, country_code=DE, city=Berlin

GEO_PROVIDER_A_MODE=down GEO_PROVIDER_B_MODE=down
  → submission stored, HTTP 201, geo_provider and country_code both empty
```

Real-network check (not part of the mocked flow above):

```
$ node scripts/testGeoProvider.js
Testing provider A (ip-api.com) against 8.8.8.8...
Provider A result: { countryCode: 'US', region: 'Virginia', city: 'Ashburn', ... }

Testing provider B (ipapi.co) against 8.8.8.8...
Provider B result: null            ← likely rate-limited by ipapi.co's free tier; provider A's real response is genuine
```

**Proves:** all three states in the fallback chain (A answers, A down → B answers, both down) are demonstrable against the live, running system, and provider A's real network path genuinely works against a public IP.

### §14 — Email side effect fails (Probe 5)

```
EMAIL_FORCE_FAIL=true npm start

$ curl -s -X POST $API/api/submissions -H "$CT" -d '{"widgetId":"<A>","payload":{"email":"forcefail@test.com"}}'
{"id":"ab370bbc-...", ...}
HTTP 201                          ← the submission still succeeds

$ dbq -c "SELECT count(*) FROM submissions WHERE payload->>'email'='forcefail@test.com';"   → 1

(30 seconds later, after 3 retry attempts with backoff)
$ dbq -c "SELECT j.status, j.attempts, j.last_error, j.failure_alerted_at IS NOT NULL AS alerted
          FROM jobs j JOIN submissions s ON s.id=j.submission_id
          WHERE s.payload->>'email'='forcefail@test.com';"
 status | attempts |                  last_error                  | alerted
--------+----------+-----------------------------------------------+---------
 failed |        3 | Forced email failure (EMAIL_FORCE_FAIL=true) | t

$ curl -s -b /tmp/jarA.txt "$API/api/dashboard/submissions?widgetId=<A>" | grep -o 'forcefail@test.com'
forcefail@test.com                ← still visible in the dashboard
```

**Proves:** a genuinely throwing side effect (not just a hypothetical) never fails the submission itself, retries three times with backoff, and is correctly marked permanently failed with an alert flag — while the submission remains stored and visible.

### §15 — Dashboard endpoints

```
GET /api/dashboard/overview
  {"totalWidgets":3,"totalSubmissions":29,"totalSpam":1,"submissionsLast24h":29,"submissionsLast7d":29}

GET /api/dashboard/submissions?widgetId=<A>&limit=2&offset=0
  2 rows returned, "total":7                       ← pagination working, total independent of page size

GET /api/dashboard/submissions?widgetId=<A>&includeSpam=true
  contains "spam":true                              ← the spam row is included only when asked for

GET /api/dashboard/submissions?limit=abc
  400 "Invalid request data"                        ← non-numeric query param rejected cleanly

GET /api/dashboard/widgets/<A>/stats
  {"totalSubmissions":7,"totalSpam":1,"dailyCounts":[{"date":"2026-09-28","count":7}]}
                                                     ← plain YYYY-MM-DD date string, not a timezone-shifted value

GET /api/dashboard/geo
  {"breakdown":[{"countryCode":"DE","count":1},{"countryCode":"US","count":1}]}
```

### §16 — Logout

```
POST /api/auth/logout, no CSRF token          → 403
POST /api/auth/logout, correct token          → 200 "Logged out successfully"
                                                  Set-Cookie: connect.sid=; Expires=1970...
                                                  Set-Cookie: csrf_token=; Expires=1970...
GET /api/auth/me on the logged-out cookie jar → 401
GET /api/auth/me on Tenant A's separate jar   → 200                       ← independent sessions, one logout doesn't affect the other

$ dbq -c "SELECT count(*) FROM sessions;"   → 2    (Tenant A and Tenant B; the logged-out session is gone)
```

### §17 — Login brute-force protection

```
$ for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " -X POST $API/api/auth/login -H "$CT" \
    -d '{"email":"nobody@test.com","password":"wrongpassword"}'; done
401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 401 429 429 429 429 429

$ curl -s -X POST $API/api/auth/login -H "$CT" -d '{"email":"a@test.com","password":"password123"}'
{"error":"Too many attempts. Please wait a few minutes and try again."}
HTTP 429                          ← even the CORRECT password is blocked once the limit is hit
```

**Proves:** the login endpoint is genuinely brute-force resistant — twenty wrong attempts trip the limiter, and it doesn't distinguish a correct password from a wrong one once tripped, which is the correct behavior.

---

## 4. Browser walkthrough — screenshots

All screenshots are in `/screenshots` at the project root. Backend was restarted with `GEO_PROVIDER_A_MODE=mock` before this section so the Overview page and geo table would have real data to show.

| # | File | What it shows |
|---|---|---|
| 1 | `01-protected-redirect.png` | Logged out, navigating to `/dashboard` redirects to `/login` — the URL bar confirms the redirect actually happened |
| 2 | `02-signup-page.png` | Centred signup card, maroon/beige theme |
| 3 | `03-signup-validation-error.png` | Signing up with a malformed email surfaces the server's field-level message inline |
| 4 | `04-overview-empty.png` | Fresh account: Overview page with all-zero stat cards and the empty-state prompt |
| 5 | `05-widgets-empty.png` | Widgets list, empty state with "Create your first widget" |
| 6 | `06-widget-detail-snippet.png` | Widget created; detail page shows the real embed `<script>` snippet with a copy button |
| 7 | `07-widget-edited-version2.png` | After editing name/type, the detail page shows `Version: 2` |
| 8 | `08-delete-confirm.png` | Native browser confirm dialog before a destructive delete, naming the widget by title |
| 9 | `09-widget-on-second-origin.png` | The real snippet pasted into `test-site/index.html`, rendered live on `localhost:5500` — a different origin from the API on `localhost:3000` |
| 10 | `10-empty-submit-blocked.png` | Clicking Submit on an empty widget form triggers the browser's native "Please fill out this field" validation — nothing is sent |
| 11 | `11-submit-success.png` | A filled, valid submission shows the green "Thanks — your message was sent" status |
| 12 | `12-network-post-headers.png` | DevTools Network tab: the `POST /api/submissions` response headers, showing `Access-Control-Allow-Origin: *` and `Cross-Origin-Resource-Policy: cross-origin` actually present on a real cross-origin browser request |
| 13 | `13-network-preflight.png` | The `OPTIONS` preflight request/response for the same submission, 204 with the correct `Access-Control-Allow-*` headers |
| 14 | `14-honeypot-payload.png` | Console-injected honeypot value (`website: "x"`) visible in the DevTools request payload before submitting |
| 15 | `15-submissions-with-spam.png` | Dashboard Submissions page, "Include spam" checked — the honeypot-flagged row visible with a grey Spam badge |
| 16 | `16-submissions-default.png` | Same page, unchecked — the spam row hidden by default |
| 17 | `17-overview-stats-geo.png` | Overview page with real stat counts and the "Submissions by country" table populated from mocked geo data |
| 18 | `18-widget-429-message.png` | A scripted burst of 25 submissions from the widget's own form; the widget's status region shows the rate-limit-specific message, distinct from a generic network-error message |
| 19 | `19-cross-tenant-404.png` | Incognito window as Tenant B, navigating directly to Tenant A's widget detail URL — the dashboard shows a "Widget not found" state, not Tenant A's data |
| 20 | `20-tenant-b-overview.png` | Tenant B's own Overview page: all zeros, confirming no bleed-through from Tenant A's data |
| 21 | `21-keyboard-focus.png` | Tabbing through the login form with the mouse untouched — a visible focus ring on the focused input |
| 22 | `22-mobile-dashboard.png` | DevTools device emulation, phone width, dashboard layout reflowing correctly |
| 23 | `23-mobile-login.png` | Same emulation, login page |
| 24 | `24-lighthouse-login.png` | Lighthouse Accessibility audit on `/login` — **100/100** |
| 25 | `25-lighthouse-dashboard.png` | Lighthouse Accessibility audit on `/dashboard` — **100/100** |
| 26 | `26-lighthouse-widget.png` | Lighthouse Accessibility audit on the widget's page (`localhost:5500`) — **100/100** |
| 27 | `27-after-logout.png` | After clicking Log out, landing on `/login`; pressing the browser Back button does not return to the dashboard |
| 28 | `28-login-rate-limited.png` | After the console-scripted brute-force loop (see below), a normal UI login attempt shows the rate-limit error message |

**Scripts used for #18 and #28**, run from the DevTools console on the relevant page:

```javascript
// #18 — burst-submit the widget's own form (localhost:5500)
const f = document.querySelector('.flyrank-widget__card form');
for (let i = 0; i < 25; i++) {
  f.querySelector('[name=name]').value = 'Burst ' + i;
  f.querySelector('[name=email]').value = 'burst' + i + '@test.com';
  f.requestSubmit();
  await new Promise((r) => setTimeout(r, 200));
}
```

```javascript
// #28 — brute-force the login endpoint (dashboard login page)
for (let i = 0; i < 25; i++) {
  await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@test.com', password: 'wrongpassword' }),
  });
}
```