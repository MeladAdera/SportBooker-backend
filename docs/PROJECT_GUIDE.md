# Sportbooker — Complete Study & Test Guide

Study and understand every file and feature in this project, letter by letter.

---

## Table of Contents

### Part I: File-by-File Walkthrough

1. [Entry Point: main.ts](#1-entry-point-maints)
2. [App Module & Controllers](#2-app-module--controllers)
3. [Config & Environment](#3-config--environment)
4. [Common: Filters, Interceptors, Pipes](#4-common-filters-interceptors-pipes)
5. [Tenant (Multi-Tenancy)](#5-tenant-multi-tenancy)
6. [Database Layer](#6-database-layer)
7. [Migration & Seed Scripts](#7-migration--seed-scripts)

### Part II: Feature Deep Dives

8. [Request Lifecycle End-to-End](#8-request-lifecycle-end-to-end)
9. [Validation & Response Envelope](#9-validation--response-envelope)
10. [Multi-Tenancy Flow](#10-multi-tenancy-flow)

### Part III: Test & Verify

11. [Test Commands & Manual Verification](#11-test-commands--manual-verification)
12. [Seed Credentials Reference](#12-seed-credentials-reference)

---

# Part I: File-by-File Walkthrough

---

## 1. Entry Point: main.ts

**Path:** `src/main.ts`

**Purpose:** Bootstrap the NestJS application. Runs once at startup.

### Line-by-line

| Lines | What it does                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–9   | **Imports.** `NestFactory` creates the app. `ValidationPipe` validates DTOs. `DocumentBuilder` / `SwaggerModule` build API docs. Custom filter, interceptors, exception factory.                                                                                                                                                                                               |
| 11–12 | **Create app.** `NestFactory.create(AppModule)` instantiates the app from the root module.                                                                                                                                                                                                                                                                                     |
| 14–21 | **ValidationPipe (global).** Every `@Body()`, `@Query()`, `@Param()` with a DTO is validated. `whitelist: true` strips unknown properties. `forbidNonWhitelisted: true` rejects requests with unknown properties (anti–mass-assignment). `transform: true` coerces types (string→number, etc.). `exceptionFactory` turns validation failures into 422 with field-level errors. |
| 22    | **HttpExceptionFilter (global).** Any thrown `HttpException` is caught and normalized to `{ statusCode, message, timestamp, errors? }`.                                                                                                                                                                                                                                        |
| 23–26 | **Interceptors (global).** `LoggingInterceptor` first (outer): logs method, path, status, duration. `TransformInterceptor` second (inner): wraps success responses in `{ data, statusCode }`.                                                                                                                                                                                  |
| 28    | **Shutdown hooks.** Enables graceful shutdown on SIGTERM.                                                                                                                                                                                                                                                                                                                      |
| 30–41 | **Swagger (non-production only).** If `NODE_ENV !== 'production'`, builds OpenAPI doc and serves Swagger UI at `api/docs`. `addBearerAuth()` adds the Authorize button for JWT.                                                                                                                                                                                                |
| 43–46 | **Start server.** Reads `PORT` from config, calls `app.listen(port)`.                                                                                                                                                                                                                                                                                                          |
| 47–50 | **Error handling.** If bootstrap throws, log and exit with code 1.                                                                                                                                                                                                                                                                                                             |

---

## 2. App Module & Controllers

### 2.1 app.module.ts

**Path:** `src/app.module.ts`

| Lines | What it does                                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10–19 | **ConfigModule.** `isGlobal: true` so `ConfigService` is available everywhere. `envFilePath: '.env'` loads env from `.env`. `validationSchema: envSchema` validates env at startup via Joi. `allowUnknown: true` allows extra env vars. `abortEarly: false` reports all validation errors. |
| 20–21 | **DatabaseModule, TenantModule.** Database provides `DB_POOL`; TenantModule registers tenant middleware.                                                                                                                                                                                   |
| 23–24 | **AppController, AppService.** App-level HTTP routes and service.                                                                                                                                                                                                                          |

### 2.2 app.controller.ts

**Path:** `src/app.controller.ts`

| Lines | What it does                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6–7   | **@ApiTags('App').** Groups this controller under "App" in Swagger.                                                                                                                                                             |
| 8–9   | **@Controller().** Base path is `/`. `constructor` injects `AppService`.                                                                                                                                                        |
| 11–16 | **GET /.** Returns `getHello()` string. `@ApiResponse({ status: 200 })` documents success. Health-check endpoint; no tenant required.                                                                                           |
| 18–35 | **POST /test-validation.** Accepts `TestValidationDto` in body. Returns `{ received: dto }`. Used to test validation and response envelope. `@ApiResponse` documents possible status codes (201, 400, 401, 403, 404, 409, 422). |

### 2.3 app.service.ts

**Path:** `src/app.service.ts`

| Lines | What it does                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------ |
| 3–7   | **AppService.** `getHello()` returns `'Hello World!'`. Placeholder for app-level business logic. |

### 2.4 app.dto.ts

**Path:** `src/app.dto.ts`

| Lines | What it does                                                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4–16  | **TestValidationDto.** `email`: `@IsEmail()` (valid email), `@ApiProperty` for Swagger. `name`: `@IsString()`, `@MinLength(2)`, `@ApiProperty`. Used by `POST /test-validation`. |

---

## 3. Config & Environment

### 3.1 env.schema.ts

**Path:** `src/config/env.schema.ts`

**Purpose:** Joi schema for env validation. Used by `ConfigModule.forRoot({ validationSchema })`.

| Var / group                                               | Purpose                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `PORT`                                                    | HTTP port (default 3000).                                                 |
| `NODE_ENV`                                                | `development` \| `production` \| `test` (default `development`).          |
| `TENANT_HOST_SUFFIX`                                      | **Required.** Domain for subdomain extraction (e.g. `localhost:3000`).    |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | **Required.** PostgreSQL connection.                                      |
| `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MILLIS`, ...         | Optional pool settings (defaults in schema).                              |
| `JWT_ACCESS_SECRET`                                       | **Required.** Min 32 chars. Used to sign/verify access JWTs.              |
| `JWT_ACCESS_EXPIRES_IN`                                   | Access token TTL (default `15m`).                                         |
| `API_PUBLIC_ORIGIN`                                       | Optional. Public API origin (uploads, Ziina webhooks). Default `http://localhost:{PORT}`. |
| `WEB_APP_PUBLIC_ORIGIN`                                   | Optional. Browser app origin (scheme for Ziina redirects); defaults to API origin.          |
| `STRIPE_*`, `RESEND_API_KEY`, `EMAIL_FROM`                | Optional; transactional email via Resend.                                 |

---

## 4. Common: Filters, Interceptors, Pipes

### 4.1 http-exception.filter.ts

**Path:** `src/common/filters/http-exception.filter.ts`

| Lines | What it does                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 10    | **@Catch(HttpException).** Catches all `HttpException` (and subclasses).                                                                 |
| 14–18 | **catch().** Gets HTTP context, request, response. `exception.getStatus()` → HTTP status. `exception.getResponse()` → message or object. |
| 21–24 | **Normalize body.** If response is an object, use it; else wrap in `{ message }`.                                                        |
| 26–33 | **Build payload.** `statusCode`, `message`, `timestamp`. If `body.errors` exists (e.g. validation), add it.                              |
| 35–37 | **Log and send.** Logs warn, then `res.status(status).json(payload)`.                                                                    |

### 4.2 transform.interceptor.ts

**Path:** `src/common/interceptors/transform.interceptor.ts`

| Lines | What it does                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11–14 | **ApiResponse<T>.** Shape `{ data: T, statusCode: number }`.                                                                                                                                               |
| 21–32 | **intercept().** Runs after controller. `next.handle()` returns Observable of controller result. `map()` wraps it in `{ data, statusCode }`. `statusCode` from `res.statusCode` (set by Nest for success). |

### 4.3 logging.interceptor.ts

**Path:** `src/common/interceptors/logging.interceptor.ts`

| Lines | What it does                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 13–18 | **intercept().** Reads `method`, `path`, stores `start`.                                                |
| 20–31 | **tap().** On success: logs `METHOD path STATUS duration`. On error: logs `METHOD path error duration`. |

### 4.4 validation-exception.factory.ts

**Path:** `src/common/pipes/validation-exception.factory.ts`

| Lines | What it does                                                                                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 9–24  | **createValidationExceptionFactory().** Returns a function that receives `ValidationError[]` from class-validator. Maps each to `{ field, messages }`. Filters empty. Returns `UnprocessableEntityException({ message: 'Validation failed', errors })` so ValidationPipe yields 422 with field-level errors. |

### 4.5 tenant.types.ts

**Path:** `src/common/tenant.types.ts`

| Lines | What it does                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------- |
| 5–12  | **Tenant interface.** Matches tenant row from DB: `id`, `name`, `slug`, `is_active`, `created_at`, `updated_at`. |
| 14–21 | **Express.Request augmentation.** Extends `Request` with optional `tenant?: Tenant`. Set by TenantMiddleware.    |

### 4.6 common/index.ts

**Path:** `src/common/index.ts`

Barrel / placeholder for common exports. Currently a comment only.

---

## 5. Tenant (Multi-Tenancy)

### 5.1 tenant.module.ts

**Path:** `src/tenant/tenant.module.ts`

| Lines | What it does                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7–16  | **configure(consumer).** Applies `TenantMiddleware` to all routes `*` except: `GET /`, `ALL /test-validation`, `ALL /admin/tenants`, `ALL /admin/tenants/(.*)`. |

### 5.2 tenant.middleware.ts

**Path:** `src/tenant/tenant.middleware.ts`

| Lines   | What it does                                                                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14–37   | **Tenant cache.** In-memory cache (TTL 60s) to avoid repeated DB lookups per subdomain. `getCachedTenant`, `setCachedTenant`. `invalidateTenantCache` exported for future use.                     |
| 54–66   | **extractSubdomain(host, appDomain).** Host must end with appDomain and prefix must end with `.`. Example: `acfc.localhost:3000` + `localhost:3000` → `acfc`. Rejects e.g. `evil-sportbooker.com`. |
| 76–84   | **Host and subdomain.** Reads Host (or X-Forwarded-Host). Extracts subdomain. Throws 400 if missing/invalid.                                                                                       |
| 86–97   | **DB lookup.** Reads from cache or `SELECT ... FROM tenants WHERE slug = $1`. Throws 404 if not found. Throws 403 if `is_active = false`.                                                          |
| 104–112 | **Attach tenant.** Sets `req.tenant = { ... }` and calls `next()`.                                                                                                                                 |

---

## 6. Database Layer

### 6.1 database.constants.ts

**Path:** `src/database/database.constants.ts`

Defines `DB_POOL` injection token. Used for `@Inject(DB_POOL)` to get the pg `Pool`.

### 6.2 pool-config.ts

**Path:** `src/database/pool-config.ts`

| Function                    | Purpose                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `createPoolConfig(input)`   | Builds `pg.PoolConfig` from typed input. Handles `statement_timeout` via `options`.    |
| `getPoolConfigFromEnv(env)` | Builds config from raw env (used by migrate/seed). Throws if required DB vars missing. |

### 6.3 db.provider.ts

**Path:** `src/database/db.provider.ts`

| Lines | What it does                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7–49  | **createDbPoolFactory().** Factory provider for `DB_POOL`. Injects `ConfigService`, builds config, creates `pg.Pool`. Connects once to verify. Listens for pool `error`. Returns the pool. |

### 6.4 db.module.ts

**Path:** `src/database/db.module.ts`

| Lines | What it does                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------- |
| 7–12  | **@Global() DatabaseModule.** Registers pool factory, exports `DB_POOL`. Pool available app-wide. |
| 14–18 | **onModuleDestroy.** Calls `pool.end()` on shutdown.                                              |

---

## 7. Migration & Seed Scripts

### 7.1 migrate.ts

**Path:** `database/migrate.ts`

| Steps | What it does                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Loads `.env` via `dotenv/config`.                                                                                                     |
| 2     | Creates pool from env (`getPoolConfigFromEnv`).                                                                                       |
| 3     | Creates `_migrations` table if missing.                                                                                               |
| 4     | Reads applied filenames from `_migrations`.                                                                                           |
| 5     | Lists `database/migrations/*.sql`, sorted.                                                                                            |
| 6     | For each file: if already applied, skip; else run in transaction: execute SQL, insert into `_migrations`, commit. On error: rollback. |
| 7     | Exits 0 on success, 1 on failure.                                                                                                     |

### 7.2 seed.ts

**Path:** `database/seed.ts`

| Steps | What it does                                              |
| ----- | --------------------------------------------------------- |
| 1     | Loads `.env`, creates pool from env.                      |
| 2     | Lists `database/seeds/*.sql`, sorted.                     |
| 3     | Executes each file in order. No transaction across files. |
| 4     | Exits 0 on success, 1 on failure.                         |

### 7.3 001_seed_tenants.sql

Inserts 2 tenants: `acfc` (Europe/London), `downtown` (America/New_York). Uses `ON CONFLICT (slug) DO UPDATE` to upsert timezone.

### 7.4 002_seed_users.sql

Inserts 8 users (4 roles × 2 tenants) via `INSERT ... SELECT` joined to tenants by slug. Password: bcrypt hash of `Password123!`. `ON CONFLICT (tenant_id, email) DO NOTHING`.

### 7.5 003_seed_venues.sql

Inserts 5 venues (3 ACFC, 2 Downtown) joined to tenants. `ON CONFLICT (tenant_id, name) DO NOTHING`. Requires migration 014 (unique index on `(tenant_id, name)`).

### 7.6 004_seed_matches.sql

Inserts 8 matches (past, ongoing, upcoming) joined to tenants and venues. `ON CONFLICT (venue_id, scheduled_at) DO NOTHING`. Requires migration 015 (unique index).

---

# Part II: Feature Deep Dives

---

## 8. Request Lifecycle End-to-End

```
HTTP Request
    │
    ▼
┌─────────────────────────┐
│ LoggingInterceptor     │  start timer
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ TenantMiddleware       │  (if not excluded) → req.tenant
│ - extractSubdomain     │
│ - DB lookup or cache   │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ ValidationPipe         │  (if @Body/@Query DTO) validate, transform
│ - invalid? → 422       │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ Controller handler     │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ TransformInterceptor   │  wrap in { data, statusCode }
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ LoggingInterceptor     │  log method path status duration
└─────────────────────────┘
    │
    ▼
HTTP Response
```

**On exception:** HttpExceptionFilter catches, returns `{ statusCode, message, timestamp, errors? }`. TransformInterceptor is skipped.

---

## 9. Validation & Response Envelope

### Success shape

```json
{ "data": <controller result>, "statusCode": 200 }
```

### Error shape

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "errors": [{ "field": "email", "messages": ["email must be an email"] }]
}
```

### ValidationPipe options

- **whitelist:** Strip properties not in DTO.
- **forbidNonWhitelisted:** Reject if unknown properties exist.
- **transform:** Coerce query/body to DTO types (needs class-transformer).
- **exceptionFactory:** Produce 422 with field-level errors.

See [VALIDATION_AND_RESPONSE_ENVELOPE.md](VALIDATION_AND_RESPONSE_ENVELOPE.md) for more detail.

---

## 10. Multi-Tenancy Flow

1. **Host:** e.g. `acfc.localhost:3000`
2. **TENANT_HOST_SUFFIX:** e.g. `localhost:3000`
3. **extractSubdomain:** `acfc.localhost:3000` ends with `localhost:3000`, prefix `acfc.` → subdomain `acfc`
4. **Lookup:** `SELECT ... FROM tenants WHERE slug = 'acfc'`
5. **Attach:** `req.tenant = { id, name, slug, is_active, ... }`
6. Later handlers use `req.tenant` for tenant-scoped logic.

---

# Part III: Test & Verify

---

## 11. Test Commands & Manual Verification

### Scripts

```bash
npm run build          # Compile
npm run start          # Run once
npm run start:dev      # Watch
npm run migrate        # DB migrations
npm run seed           # DB seeds (after migrate)
npm run test           # Unit tests
npm run test:e2e       # E2E
npm run lint           # ESLint
npm run type-check     # tsc --noEmit
```

### Manual API checks

```bash
# Health (no tenant)
curl -s http://localhost:3000/

# Validation invalid
curl -s -X POST http://localhost:3000/test-validation \
  -H "Content-Type: application/json" -d '{"email":"x","name":"a"}'

# Validation valid
curl -s -X POST http://localhost:3000/test-validation \
  -H "Content-Type: application/json" -d '{"email":"a@b.com","name":"John"}'

# Tenant route (after seed)
curl -s -H "Host: acfc.localhost:3000" http://localhost:3000/

# Swagger (dev only)
open http://localhost:3000/api/docs
```

---

## 12. Seed Credentials Reference

| Tenant   | Role         | Email                     | Password     |
| -------- | ------------ | ------------------------- | ------------ |
| acfc     | super_admin  | super-admin@acfc.test     | Password123! |
| acfc     | tenant_admin | admin@acfc.test           | Password123! |
| acfc     | tenant_staff | staff@acfc.test           | Password123! |
| acfc     | player       | player@acfc.test          | Password123! |
| downtown | super_admin  | super-admin@downtown.test | Password123! |
| downtown | tenant_admin | admin@downtown.test       | Password123! |
| downtown | tenant_staff | staff@downtown.test       | Password123! |
| downtown | player       | player@downtown.test      | Password123! |

**Access:** `acfc.localhost:3000` or `downtown.localhost:3000` (with `TENANT_HOST_SUFFIX=localhost:3000`).

---

## Related docs

- [VALIDATION_AND_RESPONSE_ENVELOPE.md](VALIDATION_AND_RESPONSE_ENVELOPE.md) — Validation & envelope
- [MIGRATIONS.md](MIGRATIONS.md) — Schema & migrations
- [README.md](../README.md) — Quick start
