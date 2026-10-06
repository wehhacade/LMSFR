# LMSBR v3 — Project Overview & Performance Guide

LMSBR v3 is a Somalia-focused security and law-enforcement management platform. It replaces an older stack (v2) while keeping **legacy mobile API contracts** so an external Flutter client can keep working without changes.

The repo is a **two-app monorepo**:

| Part | Path | Role |
|------|------|------|
| Backend API | `backend/` | Django REST API, PostgreSQL, Redis, Celery |
| Web frontend | `frontend/` | Next.js dashboard for operators and admins |
| Infrastructure | `docker-compose.yml`, `nginx/`, `Makefile` | Local dev and optional production proxy |

---

## Table of contents

1. [Architecture](#architecture)
2. [Tech stack](#tech-stack)
3. [How the application works](#how-the-application-works)
4. [Domain modules](#domain-modules)
5. [Authentication & permissions](#authentication--permissions)
6. [Data migration from legacy systems](#data-migration-from-legacy-systems)
7. [Local development](#local-development)
8. [Performance strategy](#performance-strategy)
9. [Performance tools reference](#performance-tools-reference)

---

## Architecture

```
┌─────────────────┐     HTTP (JWT)      ┌──────────────────────────────┐
│  Next.js Web    │ ──────────────────► │  Django REST API  (:8000)    │
│  (:3000)        │   /api/v3/...       │  Gunicorn (4 workers)        │
└─────────────────┘                     └──────────┬───────────────────┘
                                                     │
         ┌───────────────────────────────────────────┼───────────────────────────┐
         │                                           │                           │
         ▼                                           ▼                           ▼
┌─────────────────┐                        ┌─────────────────┐        ┌─────────────────┐
│  PostgreSQL 16  │                        │  Redis 7        │        │  Celery worker  │
│  Primary data   │                        │  Cache, sessions│        │  Async tasks    │
└─────────────────┘                        │  Celery broker  │        └─────────────────┘
                                           └─────────────────┘

Optional: nginx (Docker profile `proxy`) — gzip, static/media caching, reverse proxy to Django
External: Flutter mobile app → legacy `/api/v3/...` paths on LAN IP
```

**Request flow (web):**

1. User opens the Next.js app and logs in.
2. Frontend stores JWT tokens and calls the Django API at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api/v3`).
3. Django authenticates via cached JWT, runs business logic, reads/writes PostgreSQL.
4. Hot reads are served from Redis; slow writes (audit logs, API traffic) go to Celery.
5. React Query caches API responses in the browser so navigation feels instant.

---

## Tech stack

### Backend (`backend/`)

| Layer | Technology |
|-------|------------|
| Language | Python 3.12 |
| Framework | Django 5 + Django REST Framework |
| Auth | djangorestframework-simplejwt (access + refresh, rotation, blacklist) |
| Database | PostgreSQL 16 (Docker); SQLite fallback for bare-metal dev |
| Cache / sessions | Redis 7 via `django-redis` |
| Background jobs | Celery 5 (broker and result backend on Redis) |
| Server | Gunicorn |
| Media | Pillow (image optimization), AWS S3 (legacy photos), Firebase (FCM push) |

**Django apps:**

| App | Purpose |
|-----|---------|
| `accounts` | Users, groups, RBAC, agents, locations |
| `suspects` | Suspect registry, cases, guarantors, arrests |
| `forces` | Security forces registry |
| `audit` | Audit trails, error logs, API traffic logging |
| `mobile` | Models and endpoints for the Flutter client |
| `legacy_api` | Backward-compatible URL paths from v2 |
| `core` | Shared cache utilities, legacy SQL import |
| `api` | Health check and URL aggregation |

Settings live in `backend/config/settings/` (`base.py`, `dev.py`, `prod.py`).

### Frontend (`frontend/`)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + Radix UI |
| Data fetching | TanStack React Query 5 + Axios |
| Forms | react-hook-form + Zod |
| Auth client | jwt-decode, localStorage tokens |

Key directories:

- `frontend/src/app/` — routes (`(auth)`, `(dashboard)`)
- `frontend/src/components/lmsbr/` — domain UI (suspects, forces, users, audit)
- `frontend/src/lib/` — API clients, auth, permissions, query config
- `frontend/src/hooks/` — React Query hooks per domain

---

## How the application works

### API surface

All modern REST endpoints are mounted under `/api/v3/`:

| Prefix | Examples |
|--------|----------|
| `/api/v3/auth/` | `login`, `refresh`, `me`, `me/permissions` |
| `/api/v3/accounts/` | users, groups, permissions, agents, regions |
| `/api/v3/suspect/` | suspects, cases, guarantors, arrests, stats |
| `/api/v3/forces/` | forces list, detail, stats |
| `/api/v3/` (audit) | audit-trails, error-logs, api-traffic |
| `/api/v3/health/` | DB, Redis, and Celery health |

**Legacy paths** (for Flutter / v2 clients) are mirrored at the root of `/api/v3/` via `backend/apps/legacy_api/` — e.g. `suspects-create`, `suspect-list`, `mobile/login`.

### Frontend module launcher

The dashboard is organized as **modules** defined in `frontend/src/lib/lmsbr/data.ts`:

| Module | Route | Status |
|--------|-------|--------|
| **Amniga** (security & patrol) | `/dashboard/amniga` | Suspects + forces live |
| **User Control** | `/dashboard/usercontrol` | Users, groups, permissions, agents, audit live |
| **Survey** | `/dashboard/survey` | UI shell (mock data) |
| **Dhacdooyin** (events) | `/dashboard/dhacdooyin` | UI shell (mock data) |
| **Hub-Kadhigis** (weapons registry) | `/dashboard/hub` | UI shell (stub API) |

Each module opens a **workspace** (`module-workspace.tsx`) with a sidebar. Selecting a menu item loads the corresponding list or profile page. Menu prefetching starts API calls before the page mounts.

### Frontend ↔ backend communication

1. **Login** — `POST /api/v3/auth/login/` returns access + refresh tokens.
2. **Token storage** — `localStorage` for JWT; cookie `is_authenticated=true` for Next.js route guard (`frontend/src/proxy.ts`).
3. **Authenticated requests** — Axios interceptor adds `Authorization: Bearer <access>` (`frontend/src/lib/axios.ts`).
4. **Token refresh** — On 401, a single refresh runs and queued requests retry (no thundering herd).
5. **Permissions** — `GET /api/v3/auth/me/permissions/`; live updates polled every 2s when the tab is visible.
6. **Idle logout** — 15-minute web idle policy (`SESSION_IDLE_MINUTES`).

---

## Domain modules

### Suspects (`backend/apps/suspects/`)

Core intelligence entity: name, district, case reference, status, risk level, photo, Somali-specific fields.

- Related models: cases, guarantors (*damiin*), arrests, comments
- Push notifications via Firebase Cloud Messaging
- Legacy S3 presigned URLs for photos imported from v2
- Frontend: `suspects-list-page.tsx`, `suspect-profile-page.tsx`, `frontend/src/lib/suspects-api.ts`

### Accounts & RBAC (`backend/apps/accounts/`)

- Custom `User` model (legacy integer PK compatible with old MySQL)
- Org structure: Directorate, Department, Region, County, SubCounty
- Django groups and permissions exposed via REST
- Agent records with extended profile data
- Frontend permission gating in `frontend/src/lib/permissions.ts` maps menu items to Django codenames (e.g. `suspects.view_suspect`)

### Forces (`backend/apps/forces/`)

Read-only registry of security personnel (badge, rank, unit, district, status) with Somali rank labels.

### Audit (`backend/apps/audit/`)

- **AuditTrail** — user actions (clicks, visits, CRUD, login/logout)
- **ErrorLog** — API and field errors with traceback
- **APITrafficLog** — per-request duration and metadata
- Writes are **async via Celery** so logging never blocks the API response path
- Frontend tracker: `frontend/src/lib/audit-tracker.ts` (fire-and-forget, 350ms throttle)

### Mobile (`backend/apps/mobile/`)

Models mirroring legacy MySQL tables (reports, wanted lists, car modals, user suspect tags). Consumed by the external Flutter app through legacy URL paths.

---

## Authentication & permissions

### Web (JWT)

```
Login → access token (60 min) + refresh token (1 day)
      → CachedJWTAuthentication loads user from Redis (not DB) on each request
      → /auth/me/ and /auth/me/permissions/ cached per user in Redis
      → ?fresh=1 bypasses server cache when live data is required
```

`CachedJWTAuthentication` (`backend/apps/accounts/authentication.py`) stores the authenticated `User` row in Redis to avoid a database query on every API call.

### Mobile (legacy)

Separate paths under `/api/v3/`:

- `POST /api/v3/mobile/login/`
- `POST /api/v3/login/` (legacy email token)
- PIN setup/verify endpoints
- `POST /api/v3/token/refresh/`

---

## Data migration from legacy systems

v3 imports data from the old **MySQL** production dump (`lmsbr_prod_latest`) via management commands in `backend/apps/core/`.

```bash
make import-legacy table=suspects    # Import a specific table
make import-users                    # Import users
make import-legacy-list              # List available tables
make truncate-users                  # Clear before re-import
```

SQL dumps are expected in `backend/data/`. The import preserves legacy integer primary keys so foreign keys and mobile clients stay compatible.

---

## Local development

### First-time setup

```bash
make init        # Creates .env, starts backend, runs migrations
make start       # Docker backend + npm run dev frontend
```

### Useful commands

| Command | What it does |
|---------|--------------|
| `make start-backend` | Docker only: db, redis, django, celery |
| `make migrate` | Run Django migrations |
| `make warm-cache` | Pre-warm Redis connectivity |
| `make logs-django` | Tail Django logs |
| `make frontend-build` | Production Next.js build |

### Environment files

| File | Purpose |
|------|---------|
| `.env.example` | Django secrets, Redis host URL, CORS, JWT, AWS S3 (Postgres credentials are in `docker-compose.yml`) |
| `frontend/.env.local.example` | `NEXT_PUBLIC_API_URL` |
| `compose.ports.env.example` | Host port overrides (Postgres default **5433**) |

### URLs (default)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000/api/v3 |
| Health | http://localhost:8000/api/v3/health/ |
| Silk profiler (dev only) | http://localhost:8000/silk/ |
| Flutter / LAN API | http://\<LAN-IP\>:8000/api/v3 |

---

## Performance strategy

Performance is handled at **four layers**: infrastructure, backend caching, database query tuning, and frontend client caching.

```
Browser (React Query)  →  Redis (Django cache)  →  PostgreSQL (indexed, tuned queries)
         ↑                        ↑
    Prefetch on nav          JWT user cache
    keepPreviousData         @cache_response on stats/lookups
    useDeferredValue         Celery for audit (non-blocking)
```

### Design principles

1. **Cache reads, invalidate on writes** — Stats, lookups, and `/me/` endpoints are cached in Redis; mutations call `invalidate_cache()`.
2. **Avoid N+1 queries** — ViewSets use `select_related`, `prefetch_related`, and `.only()` to fetch only needed columns.
3. **Keep the UI responsive** — React Query holds previous page data during pagination; search inputs use `useDeferredValue` to avoid re-filtering on every keystroke.
4. **Move slow work off the request path** — Audit logging and API traffic recording run in Celery workers.
5. **Compress and cache static assets** — nginx serves gzip-compressed responses and long-lived cache headers for `/static/` and `/media/`.

---

## Performance tools reference

### 1. Redis & Django caching

| Tool / file | Role |
|-------------|------|
| **Redis 7** (`docker-compose.yml`) | Cache, sessions, Celery broker; `maxmemory 256mb`, `allkeys-lru` eviction |
| **`django-redis`** (`backend/config/settings/base.py`) | Default cache backend; connection pool (`max_connections: 50`); `IGNORE_EXCEPTIONS: True` for graceful degradation |
| **`apps/core/cache.py`** | Central cache layer with `SHORT` (60s), `MEDIUM` (300s), `LONG` (3600s) TTLs; `@cache_response` decorator; `invalidate_cache()` via Redis SCAN |
| **`CachedJWTAuthentication`** | Caches authenticated user rows — eliminates per-request DB lookup |
| **`warm_cache` command** | `make warm-cache` — verifies Redis connectivity at startup |
| **View-level caching** | Stats, districts, status types, lookups, health check, presigned S3 URLs |

**Notable tuning:** Zlib compression was **removed** from the Redis client because small cache payloads (<200 bytes) made CPU cost exceed network savings — cache HITs were slower than MISSes.

### 2. TanStack React Query (frontend)

| Tool / file | Role |
|-------------|------|
| **`query-config.ts`** | Shared stale/gc times: stats 120s, lists 60s, lookups/permissions 300s, gc 600s |
| **`query-provider.tsx`** | Global defaults: `retry: 1`, `refetchOnWindowFocus: false`; devtools in development |
| **`module-prefetch.ts`** | Prefetches stats, lists, and lookups when a sidebar item is selected |
| **`use-accounts.ts`, `use-suspects.ts`, etc.** | Per-query stale times; `placeholderData: keepPreviousData` for smooth pagination |
| **`live-permissions.ts`** | Optimistic permission patches; `syncMePermissions()` for forced refresh |
| **`fetch-live-permissions.ts`** | Always sends `?fresh=1` to bypass server Redis cache |

### 3. Database performance

| Tool / pattern | Role |
|----------------|------|
| **`CONN_MAX_AGE: 60`** | Reuses PostgreSQL connections across requests |
| **`suspects/queries.py`** | Dedicated tuned querysets with `LIST_ONLY` field lists and `LEGACY_LIST_LIMIT = 250` |
| **`select_related` / `prefetch_related` / `.only()`** | Used across suspects, accounts, mobile, and legacy API views |
| **Composite indexes** | On suspects (`status + risk`, `-updated_at`), forces, audit, accounts |
| **DRF pagination** | Default page size 20; suspects max 48, forces max 60 |
| **Aggregate stats endpoints** | `Count(..., filter=Q(...))` — dashboard numbers without loading full tables |

### 4. Image & media optimization

| Tool / file | Role |
|-------------|------|
| **`photo_utils.py`** | `optimize_suspect_image()` — EXIF correction, LANCZOS resize, JPEG quality 60 |
| **S3 presigned URLs** | Cached in Redis with TTL slightly below URL expiry |
| **`@lru_cache` on boto3 client** | Avoids recreating S3 client per request |
| **`suspect-photo.tsx`** | `loading="lazy"`, `decoding="async"`; cache-bust via `?v=updated_at` |
| **Settings** | `SUSPECT_PHOTO_MAX_SIZE` 1920×1080, `SUSPECT_PHOTO_JPEG_QUALITY` 60 |

### 5. UI responsiveness patterns

| Pattern | Where used |
|---------|------------|
| **`useDeferredValue`** | Search/filter inputs on all list pages (users, suspects, forces, agents, audit) |
| **`memo()` / `useMemo` / `useCallback`** | `module-workspace.tsx`, profile tabs, permissions page |
| **Shimmer skeletons** | `shimmer.tsx`, `skeleton.tsx` — loading placeholders instead of blank screens |
| **`module-nav-persist.ts`** | Persists sidebar state in cookies/localStorage to avoid flash on SSR |
| **Audit tracker throttle** | 350ms minimum between fire-and-forget audit POSTs |

### 6. Async & background processing

| Tool | Role |
|------|------|
| **Celery** (`audit/tasks.py`) | Async audit trails, error logs, API traffic — `ignore_result=True` |
| **Gunicorn** | 4 workers in Docker; 4 workers × 2 threads in Dockerfile |
| **JSON-only DRF renderer** | Smaller response payloads (no browsable API HTML) |

### 7. nginx (optional proxy profile)

| Feature | Config |
|---------|--------|
| **gzip** | JSON, JS, CSS, plain text; `gzip_min_length 1024` |
| **Static cache** | `/static/` — 30 days, `immutable` |
| **Media cache** | `/media/` — 7 days |
| **Upload limit** | `client_max_body_size 20M` |

Enable with: `docker compose --profile proxy up`

### 8. Monitoring & profiling (development)

| Tool | Role |
|------|------|
| **django-silk** | Request profiling UI at `/silk/` — enabled in `dev.py`, disabled in `prod.py` |
| **React Query Devtools** | Inspect client-side cache in development |
| **`/api/v3/health/`** | Reports DB, Redis, Celery status and Redis hit rate |
| **API traffic middleware** | Records `duration_ms` per request for performance analysis in the audit UI |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Amniga** | Security and patrol module |
| **Tuhunsanayaasha** | Suspects |
| **Damiin** | Guarantor |
| **Ciidan** | Security forces |
| **Dhacdooyin** | Events |
| **Hub-Kadhigis** | Weapons registry |

---

## Related files

| Topic | Path |
|-------|------|
| Django settings | `backend/config/settings/base.py` |
| URL routing | `backend/config/urls.py` |
| Cache utilities | `backend/apps/core/cache.py` |
| React Query config | `frontend/src/lib/query-config.ts` |
| Module prefetch map | `frontend/src/lib/module-prefetch.ts` |
| Module definitions | `frontend/src/lib/lmsbr/data.ts` |
| Docker services | `docker-compose.yml` |
| Dev commands | `Makefile` |
| nginx config | `nginx/nginx.conf` |
