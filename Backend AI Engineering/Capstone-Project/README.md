# FlyRank Capstone — Embeddable Widget & Lead-Capture Platform

A platform where a customer creates a widget, gets a one-line `<script>` snippet, and pastes it into any website. Visitors on that site fill out the widget's form; the submission is validated, rate-limited, spam-checked, geo-enriched, stored, and shown to the widget's owner in a dashboard — all across an origin the platform doesn't control.

Built for the FlyRank Backend Engineering Internship capstone (Embeddable Widget & Lead-Capture Platform track).

## What this proves

- A full-stack system one person owns end to end: Postgres schema → Express API → React dashboard → a vanilla-JS widget that runs on a stranger's page.
- Production discipline on the public surface: CORS, a real cross-origin submission path, rate limiting, a honeypot, idempotent writes, and a geo-provider fallback chain that degrades instead of failing.
- Security that was tightened deliberately, not by accident: session regeneration on login/signup, CSRF defense on every authenticated mutation, tenant isolation enforced in every query, and a hardening pass that closed four real gaps (documented in [BUILDLOG.md](./BUILDLOG.md)).

## Other documents

| Document | What's in it |
|---|---|
| [DESIGN.md](./DESIGN.md) | Architecture, data model, API surface, the request flow, and the explicit non-goals |
| [TESTING.md](./TESTING.md) | How to run the automated suite and the full manual test walkthrough, with terminal output |
| [EVIDENCE.md](./EVIDENCE.md) | One proof per requirement from the capstone brief, cross-referenced to TESTING.md and the screenshots |
| [BUILDLOG.md](./BUILDLOG.md) | Where AI helped, what it got wrong, the bugs it caught, and the design decisions made along the way |

## Stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express 5 |
| Database | PostgreSQL 16 (Docker), raw `pg` — no ORM |
| Dashboard | React + Vite |
| Embeddable widget | Vanilla JavaScript, bundled with esbuild, zero runtime dependencies |
| Sessions | `express-session` + `connect-pg-simple` (Postgres-backed) |
| Validation | Zod |
| Payments/AI | None — out of scope for this capstone |

Two frontends exist on purpose: the **dashboard** is React, because that's what the widget owner uses in their own browser session. The **widget itself** is plain JS with no framework, because it has to load on a stranger's website in a fraction of a second without forcing a React runtime onto their page. See DESIGN.md §3 for the reasoning.

## Run it locally

Requires Docker and Node.js 20+.

```bash
git clone <this-repo-url>
cd Capstone-Project
cp .env.example .env          # defaults work as-is for local dev

docker compose up -d
docker compose ps              # wait until postgres shows (healthy)

cd backend
npm install
npm run migrate:up             # applies the schema
npm run build:widget           # builds widget/dist/v1/widget.js — required before the widget will load
npm run dev                    # http://localhost:3000

# in a second terminal
cd frontend
npm install
npm run dev                    # http://localhost:5173

# in a third terminal — the "customer website" on a different origin
cd test-site
python3 -m http.server 5500    # http://localhost:5500
```

Open `http://localhost:5173`, sign up, create a widget, copy its embed snippet from the widget's detail page, and paste it into `test-site/index.html` in place of the placeholder comment. Reload `http://localhost:5500` and the widget renders and submits across origins.

### Seeding

There is no seed script yet — `test-site/index.html` ships with the snippet placeholder empty rather than a hardcoded widget ID, so a fresh clone doesn't 404 against data that doesn't exist. Create a widget through the dashboard and paste its real snippet in. See "Known limitations" below.

### Running the tests

```bash
cd backend
npm run test          # 83 tests — see TESTING.md for the full walkthrough and manual probes
```

## Project layout

```
Capstone-Project/
├── backend/                # Express API, migrations, background job worker
├── frontend/                # React dashboard (auth, widgets, submissions)
├── widget/                  # the embeddable script (source + built bundle)
├── test-site/                # plain HTML "customer website" on a second origin
├── screenshots/              # evidence for TESTING.md / EVIDENCE.md
├── docker-compose.yml
├── README.md                 # this file
├── DESIGN.md
├── TESTING.md
├── EVIDENCE.md
├── BUILDLOG.md
└── .env.example
```

## Known limitations

These are documented trade-offs, not oversights — each one is a scope line drawn deliberately against what the capstone brief calls "realistic scope," not a bug found late.

- **No seed script.** `test-site/index.html` needs a real widget snippet pasted in by hand after signup. A one-command seed (fixed demo tenant + widget + a pre-filled test-site file) is the natural next step, not built here — see BUILDLOG.md.
- **Default widgets (no configured `fields`) are only loosely validated server-side.** The server checks the submission isn't empty and that any `email` value looks like an email, but doesn't require specific fields by name. Widgets with `config.fields` set get full required/type enforcement. See DESIGN.md §9 for why.
- **Bundle versions aren't retained once superseded.** `widget/dist/v{N}/` folders persist as long as they were built, but there's no archive or rollback story beyond that — no production CDN was in scope.
- **Rate limits are in-memory per process.** They reset on restart and don't share state across multiple backend instances; a real deployment would move this to Redis.
- **Signup reveals whether an email is already registered** (409 vs 201). Accepted trade-off for this scope — see BUILDLOG.md.
- **Browser autofill can trigger the honeypot.** A password manager or autofill that fills every input on the page, including the hidden `website` field, will get a real visitor flagged as spam. The submission isn't lost (it's still stored, just marked `spam: true` and excluded from the confirmation email), but this is a known false-positive path. Documented in BUILDLOG.md.
- **The widget's CSS can be affected by the host page's global styles.** Class names are prefixed (`flyrank-widget__*`) but not isolated via Shadow DOM. A production version would use Shadow DOM for true style isolation.