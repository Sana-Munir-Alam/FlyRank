# Task API — Auth & Access Control

A RESTful API built with **Node.js**, **Express.js**, **PostgreSQL**, and **Supabase Auth**, running as a fully containerized stack via **Docker Compose**. This stage adds real user authentication — signup, login, JWT-protected routes, token refresh, logout, and role-based access control — on top of the existing CRUD task API from prior assignments.

> **Note:** Auth is delegated entirely to Supabase. This API never stores passwords or issues its own tokens — it validates Supabase-issued JWTs on every protected request.

---

## Technologies Used

- Node.js, Express.js
- **Supabase Auth** (`@supabase/supabase-js`) — signup, login, session/token management
- PostgreSQL 16 (containerized) — task storage
- Redis 7 (containerized) — connectivity only
- Docker & Docker Compose
- Swagger UI Express, OpenAPI 3.0 (with `bearerAuth` security scheme)

---

## Why Supabase Auth Instead of Rolling My Own?

Building a custom auth system means owning password hashing, token signing, expiry, refresh rotation, and email verification — each one a place to get security wrong. Supabase handles all of that and exposes it through a small SDK (`supabase-js`), so the API's job shrinks to two things: call Supabase to issue a session, and validate the JWT Supabase already signed on every subsequent request. `authMiddleware.js` never decodes or verifies the JWT itself — it hands the raw token to `supabase.auth.getUser(accessToken)` and trusts Supabase's answer, which is the correct trust boundary: Supabase holds the signing key, this API never needs to.

---

## Running the Whole Stack

```bash
cp .env.example .env
docker compose up
```

`.env` needs `SUPABASE_URL` and `SUPABASE_KEY` in addition to the existing Postgres variables — these come from the Supabase project dashboard (Project Settings → API).

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`

---

## Auth Flow

### 1. Sign Up

```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

`POST /auth/signup` calls `supabase.auth.signUp()` and returns the created user object. No password ever touches this API's database — it's forwarded straight to Supabase, which hashes and stores it.

### 2. Log In

```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

```http
HTTP/1.1 200 OK
{"access_token":"eyJhbGciOi...","refresh_token":"wuh5gn2yprug"}
```

`POST /auth/login` calls `supabase.auth.signInWithPassword()`. On success it returns an `access_token` (a short-lived JWT) and a `refresh_token`. Wrong credentials return `401`, not `400` — the request was well-formed, the identity check failed.

### 3. Access a Protected Route

```bash
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <access_token>"
```

```http
HTTP/1.1 200 OK
{"id":"f041f24f-...","email":"test@example.com","created_at":"2026-08-04T10:10:29.95Z"}
```

Every protected route expects `Authorization: Bearer <token>`. `authMiddleware.js` rejects the request with `401` before touching the route handler if the header is missing, malformed, or the token doesn't validate against Supabase. Only on success does it attach `req.user` and call `next()`.

### 4. Refresh an Expired Token

```bash
curl -i -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
```

Returns a new `access_token`/`refresh_token` pair via `supabase.auth.refreshSession()`, so a client never has to force the user to log in again just because the short-lived access token expired.

### 5. Log Out

```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

`POST /auth/logout` is itself a protected route — you must present a valid token to invalidate it — then calls `supabase.auth.signOut()` and returns `204 No Content`.

---

## Public vs. Protected vs. Admin-Only

| Route | Auth Required | Notes |
|---|---|---|
| `GET /public/info` | No | Sanity check that unauthenticated routes still work unmodified |
| `GET /protected/profile` | Yes | Returns the authenticated user's own id/email/created_at |
| `GET /protected/dashboard` | Yes | Second protected route, proves the same middleware is reusable across handlers |
| `GET /protected/admin` | Yes + admin role | Demonstrates middleware **stacking** |

**Public route, unauthenticated:**

```bash
$ curl -i http://localhost:3000/public/info
HTTP/1.1 200 OK
{"message":"This is a public endpoint. No authentication required."}
```

**Protected route, no token:**

```bash
$ curl -i http://localhost:3000/protected/profile
HTTP/1.1 401 Unauthorized
{"error":"Missing or invalid Authorization header"}
```

**Protected route, valid token:**

```bash
$ curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <access_token>"
HTTP/1.1 200 OK
{"id":"...", "email":"test@example.com", "created_at":"..."}
```

### Admin-Only Route

`GET /protected/admin` stacks two middlewares — `authenticate` then `requireAdmin`:

```js
app.get("/protected/admin", authenticate, requireAdmin, (req, res) => {
    res.json({ message: "Welcome, admin." });
});
```

`requireAdmin` runs strictly after `authenticate`, since it reads `req.user.user_metadata.role`, which only exists once `authenticate` has populated `req.user`. A non-admin user gets past the token check but is stopped here:

```bash
$ curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"swagger@example.com","password":"password123"}'
HTTP/1.1 200 OK
{"access_token":"..."}

$ curl -i http://localhost:3000/protected/admin \
  -H "Authorization: Bearer <access_token>"
HTTP/1.1 403 Forbidden
{"error":"Admins only"}
```

An admin user (role set in Supabase's `user_metadata`) gets through both layers:

```bash
$ curl -i http://localhost:3000/protected/admin \
  -H "Authorization: Bearer <admin_access_token>"
HTTP/1.1 200 OK
{"message":"Welcome, admin."}
```

This is the point of splitting `authenticate` and `requireAdmin` into two separate middlewares rather than one combined check: `authenticate` answers *"who is this?"* and is reused on every protected route; `requireAdmin` answers *"are they allowed to do this specific thing?"* and only gets attached where it's needed. Mixing the two into one function would mean duplicating the token-validation logic anywhere a non-admin-but-still-protected route was needed.

---

## Design Decisions

- **Supabase owns identity, this API owns authorization.** `authMiddleware.js` only asks "is this token valid, and who is it," via `supabase.auth.getUser()`. Anything role- or permission-based (`requireAdmin`) is decided here, using data Supabase returns, but Supabase itself has no concept of "admin" for this app — that's `user_metadata`, set by us.
- **Auth middleware fails closed.** Missing header, malformed header, invalid token, or an unexpected error during validation all return before `next()` is called. There's no code path where a request reaches a protected handler without a verified `req.user`.
- **`requireAdmin` assumes `authenticate` already ran.** It doesn't re-verify the token or handle a missing `req.user` — it's not meant to be mounted standalone. Route order (`authenticate, requireAdmin, handler`) is what makes this safe, not defensive checks inside `requireAdmin` itself.
- **401 vs 403, used deliberately.** `401` means "I don't know who you are" (no token, bad token, expired token). `403` means "I know exactly who you are, and the answer is no" (valid token, wrong role). Collapsing these into one status code would hide *why* a request failed from the client.
- **Refresh is a separate unauthenticated endpoint.** `POST /auth/refresh` doesn't require a Bearer token — it requires a valid `refresh_token` in the body instead, since by definition a client calling it may have an *expired* access token and nothing else.
- **Logout is a protected endpoint.** Requiring a valid Bearer token to call `/auth/logout` means you can't invalidate a session you don't already hold — logging out is itself an authenticated action.
- **No hardcoded secrets:** `SUPABASE_URL` and `SUPABASE_KEY` are read from environment variables, injected via `docker-compose.yml` from `.env`, which is git-ignored.

---

## Task API (Second Priority — Unaffected by This Stage)

The task CRUD API from the previous assignment is unchanged and still runs on PostgreSQL, unauthenticated, as a separate concern from user identity:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | All tasks; supports `?done=true/false` and `?search=keyword` |
| GET | `/tasks/:id` | Task by ID |
| POST | `/tasks` | Create a task |
| PUT | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |
| GET | `/stats` | `{ total, done, open }` |
| POST | `/reset` | Restore the three sample tasks |
| GET | `/health` | App + DB health (`503` if Postgres is unreachable) |

These routes intentionally remain public in this stage — the assignment scope was adding auth as a new layer (signup/login/protected routes/refresh/logout/roles), not retrofitting every existing endpoint with `authenticate`. `/tasks` still runs against the same repository pattern and Postgres container as before; nothing about its behavior, request shapes, or response shapes changed.

---

## Swagger / OpenAPI

`openapi.json` documents every auth route (`/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`) alongside the protected routes, each with a `bearerAuth` security requirement so Swagger UI's "Authorize" button correctly attaches the token to protected requests when testing interactively at `/api-docs`.

```json
"securitySchemes": {
  "bearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
}
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public API key |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Task database credentials |
| `DATABASE_URL` | Full Postgres connection string |
| `PORT` | Port the API listens on |

---

## Project Structure

```text
Assignment 4/
├── index.js
├── db.js
├── supabase.js
├── authMiddleware.js
├── requireAdmin.js
├── tasksRepository.js
├── openapi.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── package.json
├── package-lock.json
├── README.md
```