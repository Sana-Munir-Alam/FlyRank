# FlyRank Capstone — System Design

## 1. Problem

This project is an embeddable widget and lead-capture platform.

Customers can create a widget, receive a JavaScript `<script>` snippet, and place that widget on an external website.

When a visitor submits the widget:

1. The submission is sent to the public API.
2. The API validates the request.
3. The API applies abuse protection.
4. The submission is associated with the correct widget and tenant.
5. The submission is stored in PostgreSQL.
6. The visitor's IP can be enriched with geographic information.
7. A background job performs a confirmation email or webhook side effect.
8. The customer can view submissions and statistics through the dashboard.


## 2. System Components

The system contains five main components.

### 2.1 Backend API

The Node.js + Express backend will handle:

- Authentication
- Widget CRUD
- Public widget configuration
- Public submissions
- Validation
- CORS
- Rate limiting
- Spam protection
- Geo enrichment
- Background jobs
- Dashboard APIs

### 2.2 PostgreSQL

PostgreSQL stores:

- Tenants
- Users
- Widgets
- Submissions
- Sessions
- Background jobs

### 2.3 Frontend Dashboard

The React + Vite dashboard will allow authenticated customers to:

- Log in
- Manage widgets
- View the embed snippet
- View submissions
- View dashboard statistics

### 2.4 Embeddable Widget

The widget will be written in vanilla JavaScript.

It will:

- Load the public widget configuration
- Render the widget
- Accept visitor input
- Submit the data to the public API

### 2.5 Test Site

A plain HTML customer website will be used to test the widget from a different origin.

This proves that the public widget and submission API work across origins.


## 3. Embed Flow

The widget flow is:

Customer creates widget
        ↓
Backend creates widget
        ↓
Backend provides embed script
        ↓
Customer adds script to website
        ↓
Browser loads widget JavaScript
        ↓
Widget requests public configuration
        ↓
Widget renders form
        ↓
Visitor submits form
        ↓
Public submission API
        ↓
Validation + abuse protection
        ↓
Submission stored
        ↓
Geo enrichment
        ↓
Background job created
        ↓
Dashboard can display submission and statistics


## 4. Database Model

### 4.1 Tenant

A tenant represents one customer/account using the platform.

Fields:

- `id`
- `name`
- `created_at`

A tenant can have multiple users and multiple widgets.


### 4.2 User

A user represents an authenticated customer.

Fields:

- `id`
- `tenant_id`
- `email`
- `password_hash`
- `created_at`

Every user belongs to one tenant.


### 4.3 Widget

A widget represents an embeddable widget owned by a tenant.

Fields:

- `id`
- `tenant_id`
- `name`
- `type`
- `config`
- `version`
- `active`
- `created_at`
- `updated_at`

Every widget belongs to exactly one tenant.


### 4.4 Submission

A submission represents data received through a public widget.

Fields:

- `id`
- `tenant_id`
- `widget_id`
- `payload`
- `ip_address`
- `user_agent`
- `origin`
- `country_code`
- `region`
- `city`
- `latitude`
- `longitude`
- `geo_provider`
- `spam`
- `spam_reason`
- `idempotency_key`
- `created_at`

The submission stores both `tenant_id` and `widget_id`.

This allows the application to enforce tenant isolation and efficiently query submissions.


### 4.5 Session

A session stores authenticated login sessions.

Fields:

- `sid`
- `sess`
- `expire`

The session will be used by the Express authentication system.


### 4.6 Job

A job represents background work that should not block the public submission request.

Fields:

- `id`
- `tenant_id`
- `submission_id`
- `type`
- `status`
- `attempts`
- `max_attempts`
- `available_at`
- `locked_at`
- `last_error`
- `failure_alerted_at`
- `created_at`
- `completed_at`

Jobs can be retried when they fail.


## 5. Tenant Isolation

Every customer-owned resource belongs to a tenant.

The ownership structure is:

Tenant
  ├── Users
  └── Widgets
        └── Submissions
              └── Jobs

When an authenticated user requests a resource, the backend must check both:

- the resource ID
- the authenticated user's tenant ID

For example:

```sql
SELECT *
FROM widgets
WHERE id = $1
AND tenant_id = $2;
```

The backend must not retrieve customer-owned resources by ID alone.

The same rule applies to submissions:

```sql
SELECT *
FROM submissions
WHERE id = $1
AND tenant_id = $2;
```

This prevents one tenant from accessing another tenant's widgets or submissions.

## 6. API Surface

### Authentication

| Method | Endpoint | Authentication |
|---|---|---|
| `POST` | `/api/auth/signup` | Public |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/logout` | Required |
| `GET` | `/api/auth/me` | Required |

### Widget Management

These endpoints require authentication.

| Method | Endpoint |
|---|---|
| `GET` | `/api/widgets` |
| `POST` | `/api/widgets` |
| `GET` | `/api/widgets/:id` |
| `PATCH` | `/api/widgets/:id` |
| `DELETE` | `/api/widgets/:id` |

### Public Widget Delivery

These endpoints are public.

| Method | Endpoint |
|---|---|
| `GET` | `/widgets/:id/config` |
| `GET` | `/widget/v1/widget.js` |

The configuration endpoint will use HTTP caching.

The widget JavaScript will be served as a versioned bundle.

### Public Submissions

| Method | Endpoint |
|---|---|
| `OPTIONS` | `/api/submissions` |
| `POST` | `/api/submissions` |

The submission endpoint must support cross-origin requests.

### Dashboard

These endpoints require authentication.

| Method | Endpoint |
|---|---|
| `GET` | `/api/dashboard/overview` |
| `GET` | `/api/dashboard/submissions` |
| `GET` | `/api/dashboard/widgets/:id/stats` |
| `GET` | `/api/dashboard/geo` |

---

## 7. Public Submission Flow

A public submission will follow this order:

```text
Receive Request
      ↓
Apply CORS Handling
      ↓
Check Request Size
      ↓
Validate Payload
      ↓
Apply Rate Limiting
      ↓
Check Spam Honeypot
      ↓
Check Idempotency Key
      ↓
Store Submission
      ↓
Perform Geo Enrichment
      ↓
Create Background Side-Effect Job
      ↓
Return Successful Response
```

The submission must still succeed if the geo providers are unavailable.

The submission must also still succeed if the background email/webhook job fails.

## 8. Geo Enrichment

The system will use two geo providers.

The fallback order is:
```text
Provider A
↓ if unavailable
Provider B
↓ if unavailable
```
No geographic information

If Provider A fails, Provider B is attempted.

If both providers fail, the submission remains valid and is stored without geographic information.

## 9. Idempotency

Public clients may retry a submission because of network failures.

The submission endpoint will therefore support an idempotency key.

The database will enforce uniqueness for:
```text
widget_id + idempotency_key
```
when an idempotency key is supplied.

This prevents the same submission from being stored multiple times because of a retry.

## 10. Background Jobs

The platform will use a PostgreSQL-backed jobs table.

A submission can create a background job for a confirmation email or webhook.

The public submission request does not wait for the side effect to finish.

A job can have these states:

- `pending`
- `processing`
- `completed`
- `failed`

Failed jobs can be retried up to their configured maximum number of attempts.

A permanently failed job will be recorded so that the failure can be detected and alerted.

---

## 11. Backend Layering

The backend follows this structure:

    HTTP Request
         ↓
       Routes
         ↓
     Middleware
         ↓
    Module / Service Logic
         ↓
    Database Layer
         ↓
     PostgreSQL

### Routes

Routes handle:

- HTTP methods
- URL parameters
- Request and response handling
- Calling application logic

Routes should not contain database queries.

### Middleware

Middleware handles cross-cutting concerns such as:

- Authentication
- CORS
- Validation
- Rate limiting
- Error handling

### Modules

Modules contain business logic for:

- Authentication
- Widgets
- Submissions
- Enrichment
- Jobs
- Dashboard

### Database Layer

The database layer handles:

- SQL queries
- Transactions
- Persistence
- PostgreSQL access

---

## 12. Explicit Non-Goal

This project will not become a full form-builder or production-scale SaaS platform.

The project will use a minimal widget interface and one or two widget types.

It will not implement:

- A full drag-and-drop form builder
- A real production CDN
- Customer domain management
- Production-scale distributed queues
- Advanced CAPTCHA infrastructure
- Production hosting infrastructure

The goal is to prove the backend architecture and the complete embeddable widget flow.