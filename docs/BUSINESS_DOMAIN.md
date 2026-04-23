# Sportbooker — Complete Business Domain Guide

> **What this project is:** A multi-tenant sports booking SaaS platform. Each tenant is a sports club or organiser. Players book spots in matches, pay from an internal wallet, and can join a waitlist. A platform admin manages all tenants. Each tenant has a super admin who owns their space. Tenant admins and staff manage venues, matches, and players day-to-day.

---

## Table of Contents

1. [The Business in One Paragraph](#1-the-business-in-one-paragraph)
2. [Core Concepts Glossary](#2-core-concepts-glossary)
3. [Multi-Tenancy Model](#3-multi-tenancy-model)
4. [Roles and Permissions](#4-roles-and-permissions)
5. [Entity Reference](#5-entity-reference)
6. [Role Lifecycles](#6-role-lifecycles)
   - [Platform Admin](#61-platform-admin-lifecycle)
   - [Super Admin](#62-super-admin-lifecycle)
   - [Tenant Admin](#63-tenant-admin-lifecycle)
   - [Tenant Staff](#64-tenant-staff-lifecycle)
   - [Player](#65-player-lifecycle)
7. [Core Domain Workflows](#7-core-domain-workflows)
   - [Tenant Onboarding](#71-tenant-onboarding)
   - [Venue Lifecycle](#72-venue-lifecycle)
   - [Match Lifecycle](#73-match-lifecycle)
   - [Booking and Waitlist Lifecycle](#74-booking-and-waitlist-lifecycle)
   - [Wallet Mechanics](#75-wallet-mechanics)
   - [Auth Flow](#76-auth-flow)
   - [User Account Lifecycle](#77-user-account-lifecycle)
8. [Business Rules Enforced in Code](#8-business-rules-enforced-in-code)
9. [Statuses and Enums Reference](#9-statuses-and-enums-reference)
10. [API Surface Overview](#10-api-surface-overview)
11. [What Exists in DB but Not Yet in API](#11-what-exists-in-db-but-not-yet-in-api)

---

## 1. The Business in One Paragraph

Sportbooker is a **white-label SaaS platform** for sports clubs and organizers (called **tenants**). Each tenant gets their own subdomain (e.g., `acfc.sportbooker.com`). Inside their tenant space, they create **venues** (football pitches, padel courts, etc.), schedule **matches**, and let **players** book spots. Players pay from an internal **wallet**. When a match is full, players join a **waitlist** — they are still charged immediately but get a refund if they never get in. When a confirmed player cancels, the first eligible waitlisted player is automatically promoted. A **platform admin** creates tenants and their initial **super admin**. The super admin is the top-level authority within their tenant and can manage tenant settings. Tenant admins and staff handle the operational work.

---

## 2. Core Concepts Glossary

| Term                   | Definition                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tenant**             | A sports club or organizer that uses the platform. Has its own slug-based subdomain, its own users, venues, and matches. Isolated from other tenants.                                                                          |
| **Venue**              | A physical sports facility owned by a tenant. Has a name, address, map URL, photo, and a list of sport types it supports.                                                                                                      |
| **Match**              | A scheduled sports game at a venue. Has a date/time, duration, price per player, max player count, and a status.                                                                                                               |
| **Booking**            | A player's reservation for a match. Can be `confirmed` (active spot) or `pending` (waitlisted).                                                                                                                                |
| **Waitlist**           | When a match is full, new bookings become `pending` (waitlisted). The player is still charged. They get a refund if they cancel or never get promoted.                                                                         |
| **Wallet**             | Each user has an internal balance. All payments go through this wallet — no external payment at booking time. Top-up is a separate future concern (likely Stripe).                                                             |
| **Wallet Transaction** | A record of every balance change: `debit` (booking charge), `refund` (cancel/waitlist), `credit` or `topup` (future).                                                                                                          |
| **Cancel Cutoff**      | A per-tenant setting (`cancel_cutoff_hours`, default 24h). For **confirmed** bookings, cancellation is allowed until match start; a **wallet refund** of `paid_amount` applies only when cancel happens at least this many hours before match start. Inside that window, cancel still succeeds but there is no refund. |
| **Position**           | Each booking has a position: `field_player` or `goalkeeper`. Maximum 2 confirmed goalkeepers per match.                                                                                                                        |
| **Soft Delete**        | Users are not hard-deleted. They get a `deleted_at` timestamp and `is_active = false`. They cannot log in but their data (bookings, transactions) is preserved.                                                                |
| **FIFO Promotion**     | When a confirmed spot opens up, the oldest (first-created) eligible pending booking is promoted automatically.                                                                                                                 |
| **Platform Tenant**    | A special system tenant (slug: `platform`, `is_active = true`) that owns the `platform_admin` user. It has no subdomain-accessible content — it exists only to satisfy the `tenant_id NOT NULL` constraint on the users table. |

---

## 3. Multi-Tenancy Model

### How tenants are resolved

Every request to a tenant-scoped route is resolved by the `TenantMiddleware`:

1. Reads the `Host` (or `X-Forwarded-Host`) header.
2. Extracts the subdomain before `TENANT_HOST_SUFFIX` (e.g., `acfc` from `acfc.sportbooker.com`).
3. Looks up the `tenants` table by `slug = 'acfc'` (with a 60-second in-memory cache).
4. If the tenant does not exist → `404`.
5. If the tenant exists but `is_active = false` → `403`.
6. If found and active → attaches tenant object to the request (`req.tenant`).

### Routes that bypass tenant resolution

These routes work without a tenant Host header:

- `GET /` — health check
- `POST /auth/refresh` — refresh token carries tenant ID in JWT
- `POST /auth/reset-password` — token carries context
- `ALL /admin/tenants*` — platform-level admin routes
- `GET /uploads/*` — static file serving

### Tenant isolation guarantee

A JWT issued for tenant A contains `tenantId: A`. The `TenantUserMatchGuard` (global guard) checks that the `tenantId` in the JWT matches the tenant resolved from the Host header. This prevents using a token from one tenant against another tenant's API.

The `platform_admin` JWT carries the `platform` tenant's ID. Since `admin/tenants*` routes are excluded from `TenantMiddleware`, `req.tenant` is always `undefined` on those routes, causing `TenantUserMatchGuard` to skip the check — so the platform admin is never blocked by tenant mismatch.

### Tenant data isolation

Every user, venue, match, and booking is scoped by `tenant_id`. There is no cross-tenant data access in any query.

---

## 4. Roles and Permissions

There are five roles. They form a strict privilege hierarchy:

```
platform_admin (5)   ← platform-level, manages all tenants
    └── super_admin (4)   ← tenant-scoped, top authority within one tenant
            └── tenant_admin (3)
                    └── tenant_staff (2)
                            └── player (1)
```

### Permission Matrix

| Action                                              | platform_admin | super_admin |                 tenant_admin                 | tenant_staff | player |
| --------------------------------------------------- | :------------: | :---------: | :------------------------------------------: | :----------: | :----: |
| Create tenant (+ initial super_admin)               |       ✅       |     ❌      |                      ❌                      |      ❌      |   ❌   |
| List / view all tenants                             |       ✅       |     ❌      |                      ❌                      |      ❌      |   ❌   |
| Update any tenant (PATCH /admin/tenants/:id)        |       ✅       |     ❌      |                      ❌                      |      ❌      |   ❌   |
| Activate / deactivate any tenant                    |       ✅       |     ❌      |                      ❌                      |      ❌      |   ❌   |
| Update own tenant settings (PATCH /tenant/settings) |       ❌       |     ✅      |                      ❌                      |      ❌      |   ❌   |
| View own tenant settings (GET /tenant/settings)     |       ❌       |     ✅      |                      ❌                      |      ❌      |   ❌   |
| List all users in tenant                            |       ❌       |     ✅      |                      ✅                      |      ✅      |   ❌   |
| List deleted users (`includeDeleted`)               |       ❌       |     ✅      |                      ✅                      |      ❌      |   ❌   |
| View own profile                                    |       ✅       |     ✅      |                      ✅                      |      ✅      |   ✅   |
| Update own profile                                  |       ✅       |     ✅      |                      ✅                      |      ✅      |   ✅   |
| Assign / change user roles                          |       ❌       |     ✅      | ✅ (cannot touch super_admin/platform_admin) |      ❌      |   ❌   |
| Delete own account                                  |       ❌       |     ❌      |                      ❌                      |      ❌      |   ✅   |
| Create venues                                       |       ❌       |     ✅      |                      ✅                      |      ✅      |   ❌   |
| Update venues                                       |       ❌       |     ✅      |                      ✅                      |      ✅      |   ❌   |
| Deactivate venues                                   |       ❌       |     ✅      |                      ✅                      |      ❌      |   ❌   |
| Activate venues                                     |       ❌       |     ✅      |                      ✅                      |      ✅      |   ❌   |
| Create matches                                      |       ❌       |     ✅      |                      ✅                      |      ✅      |   ❌   |
| Update matches                                      |       ❌       |     ✅      |                      ✅                      |      ✅      |   ❌   |
| Cancel matches                                      |       ❌       |     ✅      |                      ✅                      |      ❌      |   ❌   |
| Create bookings                                     |       ❌       |     ❌      |                      ❌                      |      ❌      |   ✅   |
| Cancel own booking                                  |       ❌       |     ❌      |                      ❌                      |      ❌      |   ✅   |
| View own bookings                                   |       ❌       |     ❌      |                      ❌                      |      ❌      |   ✅   |
| View own wallet                                     |       ❌       |     ❌      |                      ❌                      |      ❌      |   ✅   |

### Role Assignment Rules

- `PATCH /users/:id/role` can be called by `super_admin` and `tenant_admin` only.
- Assignable roles via this endpoint: `tenant_admin`, `tenant_staff`, `player`. Neither `super_admin` nor `platform_admin` can be assigned through the role-change API.
- `super_admin` is created atomically by `platform_admin` at tenant creation time (`POST /admin/tenants`).
- `platform_admin` is seeded directly into the database.
- A user cannot demote themselves (self-assignment to a lower role is blocked).
- `tenant_admin` cannot modify users with `super_admin` or `platform_admin` roles.
- `super_admin` cannot modify users with `platform_admin` role.
- `platform_admin` users are excluded from all tenant user lists (`GET /users`). `super_admin` users now appear in tenant user lists.

---

## 5. Entity Reference

### `tenants`

| Column                     | Type      | Notes                                                                                  |
| -------------------------- | --------- | -------------------------------------------------------------------------------------- |
| `id`                       | UUID      | PK                                                                                     |
| `name`                     | text      | Display name                                                                           |
| `slug`                     | text      | Unique; used for subdomain; validated against reserved slugs                           |
| `is_active`                | boolean   | Inactive = 403 on all tenant routes                                                    |
| `timezone`                 | text      | Default: `Asia/Dubai`                                                                  |
| `logo_url`                 | text      | Optional                                                                               |
| `cancel_cutoff_hours`      | integer   | Default: 24. Hours before match start required for a **wallet refund** when a player self-cancels a confirmed booking; cancel remains allowed (no refund) inside this window until kickoff. |
| `created_at`, `updated_at` | timestamp | —                                                                                      |

**Reserved slugs** (cannot be used by real tenants): `api`, `admin`, `www`, `mail`, `static`, `app`, `dashboard`, `health`, `platform`.

### `users`

| Column                     | Type             | Notes                                                                                                                  |
| -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                       | UUID             | PK                                                                                                                     |
| `tenant_id`                | UUID             | FK → tenants; every user belongs to a tenant (including `platform_admin`, who belongs to the `platform` system tenant) |
| `email`                    | text             | Unique per `(tenant_id, email)`                                                                                        |
| `password_hash`            | text             | bcrypt                                                                                                                 |
| `role`                     | `user_role` enum | `platform_admin`, `super_admin`, `tenant_admin`, `tenant_staff`, `player`                                              |
| `name`                     | text             | Display name                                                                                                           |
| `phone`                    | text             | Optional                                                                                                               |
| `photo_url`                | text             | Optional                                                                                                               |
| `wallet_balance`           | numeric          | Default: 0                                                                                                             |
| `is_active`                | boolean          | Inactive users cannot log in                                                                                           |
| `deleted_at`               | timestamp        | Soft delete marker                                                                                                     |
| `created_at`, `updated_at` | timestamp        | —                                                                                                                      |

### `venues`

| Column                     | Type      | Notes                                                                                       |
| -------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `id`                       | UUID      | PK                                                                                          |
| `tenant_id`                | UUID      | FK → tenants                                                                                |
| `name`                     | text      | Unique per tenant                                                                           |
| `address`                  | text      | —                                                                                           |
| `maps_url`                 | text      | Optional Google Maps link                                                                   |
| `picture_url`              | text      | Required (upload or URL)                                                                    |
| `sport_types`              | `TEXT[]`  | Array; CHECK constraint: must be subset of `{football, padel, cricket, generic}`, minimum 1 |
| `is_active`                | boolean   | —                                                                                           |
| `created_at`, `updated_at` | timestamp | —                                                                                           |

### `matches`

| Column                     | Type                | Notes                                                                                       |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `id`                       | UUID                | PK                                                                                          |
| `venue_id`                 | UUID                | FK → venues                                                                                 |
| `title`                    | text                | —                                                                                           |
| `sport_type`               | `sport_type` enum   | One of the valid sport types                                                                |
| `scheduled_at`             | timestamp           | Must be in the future on create/update                                                      |
| `duration_mins`            | integer             | ≥ 1                                                                                         |
| `price_per_player`         | numeric             | —                                                                                           |
| `max_players`              | integer             | —                                                                                           |
| `status`                   | `match_status` enum | Stored default: `scheduled`. Computed at query time: `upcoming`, `in_progress`, `completed` |
| `created_at`, `updated_at` | timestamp           | —                                                                                           |

Unique constraint: `(venue_id, scheduled_at)` — two matches cannot start at the exact same time at the same venue. Overlap detection in code extends this to prevent time-window collisions.

### `bookings`

| Column                     | Type                    | Notes                                                                       |
| -------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `id`                       | UUID                    | PK                                                                          |
| `match_id`                 | UUID                    | FK → matches                                                                |
| `user_id`                  | UUID                    | FK → users                                                                  |
| `status`                   | `booking_status` enum   | `pending` (waitlist), `confirmed`, `cancelled`                              |
| `paid_amount`              | numeric                 | Amount deducted from wallet on booking. Refunded on cancel or match cancel. |
| `position`                 | `booking_position` enum | `field_player` or `goalkeeper`                                              |
| `cancelled_at`             | timestamp               | Set on cancel                                                               |
| `refunded_at`              | timestamp               | Set when wallet refund is issued                                            |
| `created_at`, `updated_at` | timestamp               | —                                                                           |

Partial unique index: `(match_id, user_id)` where `status IN ('pending', 'confirmed')` — a player can only have one active booking per match (cancelled bookings do not block re-booking).

### `wallet_transactions`

| Column         | Type                  | Notes                                                      |
| -------------- | --------------------- | ---------------------------------------------------------- |
| `id`           | UUID                  | PK                                                         |
| `user_id`      | UUID                  | FK → users                                                 |
| `amount`       | numeric               | Always positive; direction implied by `type`               |
| `type`         | `wallet_tx_type` enum | `debit`, `refund`, `credit`, `topup`                       |
| `reference_id` | UUID                  | Optional; links to the booking that caused the transaction |
| `created_at`   | timestamp             | —                                                          |

### `refresh_tokens`

Rotating refresh tokens stored hashed. On login a new token is issued; on refresh the old is rotated; on logout/reset-password all tokens for that user are revoked.

### `password_reset_tokens`

Single-use reset tokens. `used_at` marks consumption. Linked to user. `POST /auth/reset-password` consumes the token and revokes all refresh tokens for that user.

---

## 6. Role Lifecycles

### 6.1 Platform Admin Lifecycle

The platform admin is the sole operator of the entire SaaS platform. They exist in the `platform` system tenant (a permanent, always-active special tenant that never serves any real subdomain). There is one platform admin, created via DB seed.

```
[Created via DB seed — lives in 'platform' system tenant]
        │
        ▼
    Logs in via POST /auth/login
    Host: platform.<TENANT_HOST_SUFFIX>
    JWT: { role: 'platform_admin', tenantId: <platform_tenant_id> }
        │
        ▼
    Manages all tenants via /admin/tenants (no tenant Host needed):
    ┌─────────────────────────────────────────────────────────────┐
    │  List all tenants   (GET /admin/tenants)                    │
    │  Get single tenant  (GET /admin/tenants/:id)                │
    │  Create tenant      (POST /admin/tenants)                   │
    │    └─ Atomic: creates tenant + super_admin in one TX        │
    │  Update tenant      (PATCH /admin/tenants/:id)              │
    │  Deactivate tenant  (POST /admin/tenants/:id/deactivate)    │
    │  Activate tenant    (POST /admin/tenants/:id/activate)      │
    └─────────────────────────────────────────────────────────────┘
        │
        ▼
    Cannot access any tenant-scoped routes
    (no venue, match, user management within tenants)
```

**Key constraints:**

- Cannot be assigned via the API — seeded only.
- Cannot access tenant-scoped routes (venues, matches, users, bookings).
- JWT's `tenantId` is the `platform` tenant ID; `TenantUserMatchGuard` skips on `admin/tenants` routes (no `req.tenant`).
- Excluded from all tenant user lists.

---

### 6.2 Super Admin Lifecycle

The super admin is the **top authority within a single tenant**. They are created atomically when the platform admin creates a tenant. One per tenant (by convention — no DB constraint prevents multiple).

```
[Created atomically by platform_admin via POST /admin/tenants]
        │
        ▼
    Logs in via POST /auth/login
    Host: <tenant-slug>.<TENANT_HOST_SUFFIX>
    JWT: { role: 'super_admin', tenantId: <tenant_id> }
        │
        ▼
    Manages own tenant settings:
    ┌─────────────────────────────────────────────────────────────┐
    │  View tenant settings  (GET /tenant/settings)               │
    │  Update tenant settings (PATCH /tenant/settings)            │
    │    Allowed fields: name, logoUrl, timezone, cancelCutoffHours│
    │    NOT allowed: is_active (platform_admin only)             │
    └─────────────────────────────────────────────────────────────┘
        │
        ▼
    Full tenant operations (same as tenant_admin + destructive):
    ┌─────────────────────────────────────────────────────────────┐
    │  Venues: create, update, activate, deactivate               │
    │  Matches: create, update, cancel                            │
    │  Users: list (including deleted), view, assign roles        │
    │    └─ Cannot demote self                                    │
    │    └─ Cannot touch platform_admin users                     │
    │  Own profile: view, update                                  │
    └─────────────────────────────────────────────────────────────┘
        │
        ▼
    Appears in GET /users results for their tenant
    (unlike platform_admin, super_admin is visible in tenant lists)
```

**Key constraints:**

- Scoped to a single tenant — cannot operate across tenants.
- Cannot activate/deactivate tenants (platform_admin exclusive).
- Cannot be assigned via `PATCH /users/:id/role` (not in `ASSIGNABLE_ROLE_VALUES`).
- Cannot be demoted by `tenant_admin`.
- Cannot book matches (booking is player-only).
- Cannot delete their own account (player-only).

---

### 6.3 Tenant Admin Lifecycle

The tenant admin is the primary operational manager of a tenant, created by the super admin.

```
[Registered as player → role assigned to tenant_admin by super_admin]
OR
[Seeded directly in DB]
        │
        ▼
    Logs in via POST /auth/login
    (tenant Host required)
        │
        ▼
    ┌──────────────── Venue Management ───────────────────┐
    │  Create venue (POST /venues)                        │
    │  Update venue (PATCH /venues/:id)                   │
    │  Activate venue (POST /venues/:id/activate)         │
    │  Deactivate venue (POST /venues/:id/deactivate)     │
    │    └─ Blocked if venue has upcoming/in-progress     │
    │       matches (409 + match count)                   │
    └─────────────────────────────────────────────────────┘
        │
        ▼
    ┌──────────────── Match Management ───────────────────┐
    │  Create match (POST /matches)                       │
    │  Update match (PATCH /matches/:id)                  │
    │  Cancel match (POST /matches/:id/cancel)            │
    │    └─ Triggers: refund all confirmed players        │
    │                 refund all prepaid pending waitlist │
    │                 send cancellation emails            │
    └─────────────────────────────────────────────────────┘
        │
        ▼
    ┌──────────────── User Management ────────────────────┐
    │  List users (GET /users) — includes deleted         │
    │  View user (GET /users/:id)                         │
    │  Assign roles (PATCH /users/:id/role)               │
    │    └─ Cannot modify super_admin or platform_admin   │
    │    └─ Cannot assign super_admin or platform_admin   │
    │    └─ Cannot demote self                            │
    └─────────────────────────────────────────────────────┘
        │
        ▼
    Manages own profile (GET/PATCH /users/me)
```

**Key constraints:**

- Cannot delete their own account (only `player` can via `DELETE /users/me`).
- Cannot modify `super_admin` or `platform_admin` users.
- Cannot update tenant settings (super_admin exclusive via `/tenant/settings`).

---

### 6.4 Tenant Staff Lifecycle

Staff are operational employees — they manage day-to-day venue and match operations but without destructive powers.

```
[Registered as player → role assigned to tenant_staff by tenant_admin or super_admin]
        │
        ▼
    Logs in via POST /auth/login
    (tenant Host required)
        │
        ▼
    ┌──────────────── Venue Management ───────────────────┐
    │  Create venue (POST /venues)                        │
    │  Update venue (PATCH /venues/:id)                   │
    │  Activate venue (POST /venues/:id/activate)         │
    │  ❌ Cannot deactivate venue                         │
    └─────────────────────────────────────────────────────┘
        │
        ▼
    ┌──────────────── Match Management ───────────────────┐
    │  Create match (POST /matches)                       │
    │  Update match (PATCH /matches/:id)                  │
    │  ❌ Cannot cancel match                             │
    └─────────────────────────────────────────────────────┘
        │
        ▼
    ┌──────────────── User Visibility ────────────────────┐
    │  List users (GET /users) — no deleted users         │
    │  View user (GET /users/:id)                         │
    │  ❌ Cannot assign roles                             │
    └─────────────────────────────────────────────────────┘
        │
        ▼
    Manages own profile (GET/PATCH /users/me)
```

**Key constraints:**

- Read-only user access (no role changes).
- Cannot perform destructive venue or match actions.
- Cannot see soft-deleted users in user list.

---

### 6.5 Player Lifecycle

The player is the end customer — the person who books and pays for spots in matches.

```
[Self-registers via POST /auth/register]
    (default role: player)
        │
        ▼
    Account active + wallet balance = 0
        │
        ▼
    [Wallet topped up — mechanism TBD, likely future Stripe integration]
        │
        ▼
    Browses matches: GET /matches
    (only upcoming matches at active venues)
    (can filter by sport, venue, date, availability)
        │
        ▼
    Books a match: POST /matches/:matchId/bookings
    ┌────────────────────────────────────────────────┐
    │  Checks:                                       │
    │  - Match exists and is not cancelled           │
    │  - Match is in the future                      │
    │  - Venue is active                             │
    │  - Player not already booked (active booking)  │
    │  - Wallet balance ≥ price_per_player           │
    │                                                │
    │  Then: Is there capacity?                      │
    │  ┌─── YES (field open, or GK slot open) ──────┐ │
    │  │   → Debit wallet                          │ │
    │  │   → Insert booking: status = confirmed    │ │
    │  │   → Insert wallet_transaction: debit      │ │
    │  └───────────────────────────────────────────┘ │
    │  ┌─── NO (full, or GK limit hit) ────────────┐ │
    │  │   → Debit wallet (prepaid)                │ │
    │  │   → Insert booking: status = pending      │ │
    │  │   → Insert wallet_transaction: debit      │ │
    │  │   → Return waitlistNotice to player       │ │
    │  └───────────────────────────────────────────┘ │
    └────────────────────────────────────────────────┘
        │
        ▼
    Waits for match OR cancels booking
    ┌────────────────────────────────────────────────┐
    │  Cancel confirmed booking:                     │
    │  - Must be before match start                  │
    │  - If ≥ cancel_cutoff_hours before start:      │
    │    full wallet refund of paid_amount           │
    │  - If inside that window: cancel, no refund    │
    │  - Triggers FIFO waitlist promotion (async)    │
    │                                                │
    │  Cancel pending (waitlist) booking:            │
    │  - Can cancel at any time                      │
    │  - FULL REFUND to wallet                       │
    │  - No FIFO promotion triggered                 │
    └────────────────────────────────────────────────┘
        │
        ▼
    Can view own history: GET /users/me/bookings
    Can view own wallet: GET /users/me/wallet
        │
        ▼
    Can delete own account: DELETE /users/me
    ┌────────────────────────────────────────────────┐
    │  BLOCKED if player has confirmed bookings      │
    │  in upcoming matches                           │
    │  Otherwise: soft delete + revoke tokens        │
    └────────────────────────────────────────────────┘
```

**Key constraints:**

- Only role that can book and cancel bookings.
- Only role that can delete their own account.
- Confirmed cancellations never get a refund (penalty for no-shows).
- Waitlist cancellations always get a full refund.

---

## 7. Core Domain Workflows

### 7.1 Tenant Onboarding

```
platform_admin → POST /admin/tenants
    body: {
      tenant: { name, slug, timezone?, logoUrl?, cancelCutoffHours? },
      superAdmin: { name, email, password }
    }
        │
        ▼
    Validation:
    - slug not in RESERVED_SLUGS list
    - slug unique in DB
        │
        ▼
    Atomic transaction:
    ├── INSERT into tenants (is_active = true)
    └── INSERT into users (role = 'super_admin', tenant_id = new tenant id)
        │
        ▼
    Subdomain now resolves: slug.TENANT_HOST_SUFFIX
        │
        ▼
    Super admin logs in on slug.TENANT_HOST_SUFFIX
        │
        ▼
    Creates venues → creates matches → assigns tenant admins → invites players
```

**Deactivating a tenant (platform_admin only):**

- `POST /admin/tenants/:id/deactivate`
- All subsequent requests to that tenant's Host → `403`
- Existing data (users, venues, bookings) is preserved in DB
- Cache is invalidated immediately (60s TTL anyway)

---

### 7.2 Venue Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                         VENUE STATES                            │
│                                                                 │
│  [Created]  ──────────────────────────────────►  is_active=true │
│     │                                                │          │
│     │                    ┌──────────────────────────┘          │
│     │                    ▼                                      │
│     │            DEACTIVATE (super_admin or tenant_admin)       │
│     │            └─ Blocked if upcoming/in-progress matches     │
│     │               (returns 409 with match count)              │
│     │                    │                                      │
│     │                    ▼                                      │
│     │              is_active=false                              │
│     │              └─ New bookings blocked (venue inactive)     │
│     │                    │                                      │
│     │                    ▼                                      │
│     │              ACTIVATE (super_admin, tenant_admin, staff)  │
│     └──────────────────► is_active=true                         │
└─────────────────────────────────────────────────────────────────┘
```

**Create venue rules:**

- `name` must be unique per tenant.
- `sport_types` must be a non-empty array from: `football`, `padel`, `cricket`, `generic`.
- Must provide either an uploaded picture file (multipart) or a `pictureUrl`.

**Match `sport_type` constraint:**

- The `sport_type` on a match uses the broader `sport_type` enum (which includes `basketball`, `tennis`, `volleyball`, etc.).
- Venue `sport_types` array only supports the 4 venue-level types.

---

### 7.3 Match Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                         MATCH STATUSES                           │
│                                                                  │
│  STORED IN DB:    scheduled ──────────────────────► cancelled    │
│                                                                  │
│  COMPUTED:        upcoming → in_progress → completed             │
│  (from scheduled_at + duration_mins vs now())                    │
│                                                                  │
│  New matches store: scheduled                                    │
│  API returns:  upcoming / in_progress / completed / cancelled    │
└──────────────────────────────────────────────────────────────────┘
```

**Create match rules:**

- Venue must belong to same tenant and be active.
- `scheduled_at` must be in the future.
- No overlapping match at the same venue: the time window `[scheduled_at, scheduled_at + duration_mins)` must not overlap any other match at that venue. Touching edges (back-to-back) are allowed.
- Unique constraint: no two matches can have the exact same `(venue_id, scheduled_at)`.

**Update match rules:**

- Cannot update a `cancelled` match.
- `max_players` cannot be set below the current confirmed booking count.
- All create-time checks (overlap, future date) are re-applied on update (excluding self).

**Cancel match (super_admin or tenant_admin):**

```
POST /matches/:id/cancel
        │
        ▼
  Transaction begins:
        │
        ▼
  For each CONFIRMED booking:
  → Add paid_amount back to player's wallet_balance
  → Insert wallet_transaction: type=refund, reference_id=booking_id
  → Set booking: status=cancelled, cancelled_at=now, refunded_at=now
        │
        ▼
  For each PENDING (prepaid waitlist) booking:
  → Add paid_amount back to player's wallet_balance
  → Insert wallet_transaction: type=refund
  → Set booking: status=cancelled, cancelled_at=now, refunded_at=now
        │
        ▼
  Set match: status=cancelled
        │
        ▼
  Transaction commits
        │
        ▼
  Send cancellation emails to all previously confirmed players
  (async, after commit)
```

**Browse matches (any authenticated user, tenant-scoped):**

- Only matches where `now() < scheduled_at` (i.e. computed status `upcoming`) are returned.
- Only matches at active venues.
- Filterable by: `sportType`, `venueId`, `date` (UTC calendar date), `available` (spots remaining > 0).

---

### 7.4 Booking and Waitlist Lifecycle

This is the most complex part of the business.

```
┌─────────────────────────────────────────────────────────────────┐
│                      BOOKING STATUSES                           │
│                                                                 │
│   pending  ──── FIFO promotion ──────► confirmed               │
│      │                                    │                     │
│      │                                    │                     │
│   player cancel                       player cancel             │
│   (with refund)                       (no refund,               │
│      │                                 cutoff enforced)         │
│      ▼                                    │                     │
│   cancelled ◄─────────────────────────────┘                    │
│      ▲                                                          │
│      └──── match cancel (all bookings cancelled + refunded) ────┘
└─────────────────────────────────────────────────────────────────┘
```

**Goalkeeper cap:**

- Max 2 confirmed goalkeepers per match.
- If a player requests `position = goalkeeper` and there are already 2 confirmed goalkeepers but the match has outfield capacity, the GK booking goes to the **waitlist** (pending), not a hard rejection.
- The player is charged immediately even in this case.

**Full booking flow:**

```
POST /matches/:matchId/bookings
body: { position: 'field_player' | 'goalkeeper' }
        │
        ▼
  Guards: JWT + TenantUserMatch
  Role check: player only
        │
        ▼
  BEGIN TRANSACTION (SELECT ... FOR UPDATE on match + user)
        │
        ▼
  Checks:
  1. Match exists, belongs to tenant
  2. Match is not cancelled
  3. Match is in the future (scheduled_at > now())
  4. Venue is active
  5. No duplicate active booking for this user+match
  6. Wallet balance ≥ price_per_player
        │
        ▼
  Capacity check:
  ┌── Has confirmed field player spots? (confirmed < max_players)
  │   AND if position=GK: fewer than 2 confirmed GKs?
  │         │
  │   YES ──► Confirmed path
  │         │
  │         ▼
  │     Debit wallet (balance - price)
  │     Insert booking: status=confirmed, paid_amount=price
  │     Insert wallet_tx: type=debit
  │         │
  │         ▼
  │     Return: { booking, waitlistNotice: null }
  │
  └── NO (full OR GK cap hit) ──► Waitlist path
              │
              ▼
          Debit wallet (same as confirmed)
          Insert booking: status=pending, paid_amount=price
          Insert wallet_tx: type=debit
              │
              ▼
          Return: { booking, waitlistNotice: "Your wallet was charged...
                    If you don't get a spot, or cancel before the match,
                    this amount is refunded." }

  COMMIT TRANSACTION
```

**FIFO Waitlist Promotion (triggered after confirmed cancel):**

```
[Confirmed booking cancelled by player]
        │
        ▼
  COMMIT cancellation
        │
        ▼ (async, after commit)
  Query: SELECT pending bookings for this match
         ORDER BY created_at ASC
         (oldest first = FIFO)
        │
        ▼
  For each pending booking in order:
  ┌─ Check: is it a GK booking? Are 2 GKs already confirmed?
  │  If yes → skip this booking (record skippedEmail)
  │
  ├─ Check: does user have sufficient wallet balance?
  │  If they already prepaid (paid_amount > 0): skip wallet check
  │  If unpaid (legacy): check balance ≥ price
  │
  └─ Promote:
     If prepaid: no second debit (already charged on waitlist join)
     If unpaid: debit wallet now
     Set booking: status=confirmed
     Send promotion email to user
     BREAK (only one promotion per cancel event)
        │
        ▼
  If any bookings were skipped: send "slot unavailable" emails
  to skipped users
```

**Player cancel:**

```
POST /matches/:matchId/bookings/:bookingId/cancel
        │
        ▼
  Ownership check: booking.user_id = requesting player
        │
        ▼
  IF booking.status = 'confirmed':
    Check: scheduled_at > now() (match must be in future)
    If scheduled_at >= now() + cancel_cutoff_hours AND paid_amount > 0:
      Refund wallet_balance += paid_amount, wallet_tx refund, refunded_at=now
    Else:
      NO wallet refund
    Set booking: status=cancelled, cancelled_at=now
    Trigger async FIFO promotion
        │
  IF booking.status = 'pending' (waitlist):
    Set booking: status=cancelled, cancelled_at=now
    Refund: wallet_balance += paid_amount
    Insert wallet_tx: type=refund, refunded_at=now
    No FIFO promotion
        │
  IF booking.status = 'cancelled':
    → 422 already cancelled
```

---

### 7.5 Wallet Mechanics

The wallet is a simple internal balance. There is no external payment integration yet.

| Event                             | Wallet Change                | Transaction Type |
| --------------------------------- | ---------------------------- | ---------------- |
| Book a match (confirmed)          | − price_per_player           | `debit`          |
| Book a match (waitlisted)         | − price_per_player           | `debit`          |
| Cancel confirmed booking          | no change                    | —                |
| Cancel pending (waitlist) booking | + paid_amount                | `refund`         |
| Match cancelled by admin          | + paid_amount (all bookings) | `refund`         |
| FIFO promotion (prepaid)          | no change                    | —                |
| Future: top-up                    | + amount                     | `topup`          |
| Future: credit                    | + amount                     | `credit`         |

**API exposure:**

- `GET /users/me/wallet` — returns `{ balance, transactions[] }`
- Transaction type `debit` is surfaced as `"deduction"` in the API response.
- No public top-up endpoint exists yet.

**Balance protection:**

- Booking is rejected (before insert) if `wallet_balance < price_per_player`.
- Wallet update uses `SELECT FOR UPDATE` on the user row to prevent race conditions.

---

### 7.6 Auth Flow

```
REGISTER:
POST /auth/register (tenant Host required)
body: { email, password, name, phone? }
        │
        ▼
  Create user: role=player, wallet_balance=0, is_active=true
  Hash password (bcrypt)
  Return: { accessToken, refreshToken, user }

LOGIN:
POST /auth/login (tenant Host required for all roles)
body: { email, password }
        │
        ▼
  Find user by (tenant_id, email)
  Check: is_active=true, deleted_at=null
  Verify password (bcrypt)
  Issue JWT: { sub: userId, role, tenantId }
  Issue opaque refresh token (stored hashed in refresh_tokens)
  Return: { accessToken, refreshToken, expiresIn }

  platform_admin logs in via Host: platform.<TENANT_HOST_SUFFIX>
  super_admin logs in via Host: <slug>.<TENANT_HOST_SUFFIX>

REFRESH:
POST /auth/refresh (no tenant Host needed)
body: { refreshToken }
        │
        ▼
  Find hashed token in refresh_tokens
  Validate not expired / not revoked
  Issue new accessToken + new refreshToken (rotation)
  Revoke old refresh token

FORGOT PASSWORD:
POST /auth/forgot-password (tenant Host required)
body: { email }
        │
        ▼
  Anti-enumeration: always returns 200
  If user found: create password_reset_token
  Send email via Resend (or log to console if unconfigured)

RESET PASSWORD:
POST /auth/reset-password (no tenant Host needed)
body: { token, newPassword }
        │
        ▼
  Find token, check not used, not expired
  Hash new password, update user
  Mark token as used (used_at = now)
  Revoke ALL refresh tokens for this user

LOGOUT:
POST /auth/logout (JWT required)
        │
        ▼
  Revoke all refresh tokens for this user
```

---

### 7.7 User Account Lifecycle

```
[Self-register (→ player)] OR [Created atomically with tenant (→ super_admin)] OR [Seeded]
        │
        ▼
    is_active=true, deleted_at=null
        │
        ├─── Role can be changed by super_admin / tenant_admin
        │    (PATCH /users/:id/role)
        │    Assignable: tenant_admin, tenant_staff, player only
        │
        ├─── Profile can be updated by self
        │    (PATCH /users/me)
        │
        ├─── Can be deactivated (is_active=false)
        │    → Cannot log in (login rejects inactive users)
        │    → Existing JWT still works until expiry
        │
        └─── Can be soft deleted (player only: DELETE /users/me)
             BLOCKED if: confirmed bookings in upcoming matches
             Otherwise:
               is_active=false
               deleted_at=now
               All refresh tokens revoked
             → Cannot log in
             → Appears in user list only with includeDeleted=true
               (super_admin or tenant_admin only)
             → Historical bookings / wallet data preserved in DB
```

---

## 8. Business Rules Enforced in Code

| Rule                                                                 | Where enforced                   | Error                        |
| -------------------------------------------------------------------- | -------------------------------- | ---------------------------- |
| Tenant slug not reserved                                             | `TenantsService` constants       | 400                          |
| Inactive tenant                                                      | `TenantMiddleware`               | 403                          |
| JWT tenant mismatch                                                  | `TenantUserMatchGuard`           | 403                          |
| User must be active + not deleted to log in                          | `AuthService`                    | 401                          |
| Duplicate email per tenant                                           | DB unique constraint             | 409                          |
| Duplicate active booking (user + match)                              | DB partial unique index          | 409                          |
| Booking must be in the future                                        | `BookingsRepository`             | 422                          |
| Wallet must have sufficient balance                                  | `BookingsRepository`             | 422                          |
| Cancel confirmed booking only before cutoff                          | `BookingsRepository`             | 422                          |
| Cannot delete account with confirmed upcoming bookings               | `UsersService`                   | 409                          |
| Venue deactivation blocked by active matches                         | `VenuesService`                  | 409                          |
| Match overlap at same venue                                          | `MatchesRepository`              | 409                          |
| Max 2 confirmed goalkeepers                                          | `BookingsRepository`             | → waitlist (not hard reject) |
| `max_players` cannot decrease below confirmed count                  | `MatchesService`                 | 422                          |
| Cannot update cancelled match                                        | `MatchesService`                 | 422                          |
| Cannot assign `super_admin` or `platform_admin` role via tenant API  | `UsersService` + `AssignRoleDto` | 403 / 422                    |
| Cannot demote self                                                   | `UsersService`                   | 400                          |
| `tenant_admin` cannot modify `super_admin` or `platform_admin` users | `UsersService`                   | 403                          |
| `super_admin` cannot modify `platform_admin` users                   | `UsersService`                   | 403                          |
| Venue `sport_types` restricted to 4 values                           | DB CHECK constraint              | 422                          |
| `platform` slug reserved                                             | `RESERVED_SLUGS` constant        | 400                          |

---

## 9. Statuses and Enums Reference

### `match_status`

Only **`scheduled`** and **`cancelled`** are stored in the database. The remaining values are **computed at query time** from `scheduled_at + duration_mins` vs `now()` — they are never written to the DB.

| Value         | Stored?     | Meaning                                                |
| ------------- | ----------- | ------------------------------------------------------ |
| `scheduled`   | ✅ stored   | Default for all new matches                            |
| `cancelled`   | ✅ stored   | Explicitly set when admin cancels a match              |
| `upcoming`    | ⚡ computed | `now() < scheduled_at`                                 |
| `in_progress` | ⚡ computed | `scheduled_at <= now() < scheduled_at + duration_mins` |
| `completed`   | ⚡ computed | `now() >= scheduled_at + duration_mins`                |

`GET /matches` (browse) returns only matches where `now() < scheduled_at` (computed `upcoming`). All statuses are visible on `GET /matches/:id` (detail).

### `booking_status`

| Value       | Meaning                                                 |
| ----------- | ------------------------------------------------------- |
| `confirmed` | Player has an active spot; wallet was charged           |
| `pending`   | Player is on the waitlist; wallet was charged (prepaid) |
| `cancelled` | Booking cancelled (by player or match cancel)           |

### `booking_position`

| Value          | Meaning                                        |
| -------------- | ---------------------------------------------- |
| `field_player` | Regular outfield position                      |
| `goalkeeper`   | Goalkeeper position; max 2 confirmed per match |

### `wallet_tx_type`

| Value    | API label     | Meaning                                       |
| -------- | ------------- | --------------------------------------------- |
| `debit`  | `"deduction"` | Wallet charged for a booking                  |
| `refund` | `"refund"`    | Wallet credited back (cancel / match cancel)  |
| `credit` | `"credit"`    | Manual credit (future use)                    |
| `topup`  | `"topup"`     | Player adds money (future Stripe integration) |

### `sport_type` (matches)

`football`, `basketball`, `tennis`, `volleyball`, `padel`, `cricket`, `generic`, `other`

### Venue `sport_types` (tags — subset)

`football`, `padel`, `cricket`, `generic`

### `user_role`

| Value            | Rank | Scope         | Notes                                                                                                                 |
| ---------------- | ---- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `platform_admin` | 5    | Platform      | Manages all tenants; lives in `platform` system tenant; not assignable via API                                        |
| `super_admin`    | 4    | Tenant-scoped | Top authority within one tenant; created atomically with tenant by platform_admin; not assignable via tenant role API |
| `tenant_admin`   | 3    | Tenant-scoped | Full tenant management except tenant settings                                                                         |
| `tenant_staff`   | 2    | Tenant-scoped | Operational management (no destructive actions)                                                                       |
| `player`         | 1    | Tenant-scoped | End customer; default on registration                                                                                 |

---

## 10. API Surface Overview

All routes below are tenant-scoped (require correct Host header) unless marked **[PLATFORM]**.

| Method                          | Path                                    | Roles                     | Notes                                                                  |
| ------------------------------- | --------------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| GET                             | `/`                                     | public                    | Health check                                                           |
| **Auth**                        |                                         |                           |                                                                        |
| POST                            | `/auth/register`                        | public                    | Creates player; tenant Host required                                   |
| POST                            | `/auth/login`                           | public                    | Returns JWT + refresh token; all roles login via their tenant Host     |
| POST                            | `/auth/forgot-password`                 | public                    | Anti-enumeration; always 200                                           |
| POST                            | `/auth/reset-password`                  | public                    | [PLATFORM] no Host needed; consumes token                              |
| POST                            | `/auth/refresh`                         | public                    | [PLATFORM] no Host needed                                              |
| POST                            | `/auth/logout`                          | authenticated             | Revokes refresh tokens                                                 |
| **Admin (Platform)** [PLATFORM] |                                         |                           |                                                                        |
| GET                             | `/admin/tenants`                        | platform_admin            | List all tenants                                                       |
| POST                            | `/admin/tenants`                        | platform_admin            | Create tenant + super_admin atomically                                 |
| GET                             | `/admin/tenants/:id`                    | platform_admin            | Get tenant                                                             |
| PATCH                           | `/admin/tenants/:id`                    | platform_admin            | Update tenant (including is_active management)                         |
| POST                            | `/admin/tenants/:id/deactivate`         | platform_admin            | Deactivate                                                             |
| POST                            | `/admin/tenants/:id/activate`           | platform_admin            | Activate                                                               |
| **Tenant Settings**             |                                         |                           |                                                                        |
| GET                             | `/tenant/settings`                      | super_admin               | View own tenant config                                                 |
| PATCH                           | `/tenant/settings`                      | super_admin               | Update own tenant (name, logo, timezone, cutoff; NOT is_active)        |
| **Users**                       |                                         |                           |                                                                        |
| GET                             | `/users`                                | super_admin, admin, staff | List tenant users (platform_admin excluded from results)               |
| GET                             | `/users/me`                             | any                       | Own profile                                                            |
| PATCH                           | `/users/me`                             | any                       | Update own profile                                                     |
| DELETE                          | `/users/me`                             | player                    | Soft delete (if no upcoming bookings)                                  |
| GET                             | `/users/me/bookings`                    | any                       | Own booking history                                                    |
| GET                             | `/users/me/wallet`                      | any                       | Own wallet + transactions                                              |
| GET                             | `/users/:id`                            | super_admin, admin, staff | View any user in tenant                                                |
| PATCH                           | `/users/:id/role`                       | super_admin, admin        | Change user role (assignable: tenant_admin, tenant_staff, player only) |
| **Venues**                      |                                         |                           |                                                                        |
| GET                             | `/venues`                               | any authenticated         | Browse active venues                                                   |
| GET                             | `/venues/:id`                           | any authenticated         | Venue detail                                                           |
| POST                            | `/venues`                               | super_admin, admin, staff | Create venue (multipart)                                               |
| PATCH                           | `/venues/:id`                           | super_admin, admin, staff | Update venue                                                           |
| POST                            | `/venues/:id/activate`                  | super_admin, admin, staff | Activate                                                               |
| POST                            | `/venues/:id/deactivate`                | super_admin, admin        | Deactivate (blocked if matches)                                        |
| **Matches**                     |                                         |                           |                                                                        |
| GET                             | `/matches`                              | any authenticated         | Browse upcoming matches                                                |
| GET                             | `/matches/:id`                          | any authenticated         | Match detail + roster                                                  |
| POST                            | `/matches`                              | super_admin, admin, staff | Create match                                                           |
| PATCH                           | `/matches/:id`                          | super_admin, admin, staff | Update match                                                           |
| POST                            | `/matches/:id/cancel`                   | super_admin, admin        | Cancel match + refund all                                              |
| **Bookings**                    |                                         |                           |                                                                        |
| POST                            | `/matches/:matchId/bookings`            | player                    | Book or join waitlist                                                  |
| POST                            | `/matches/:matchId/bookings/:id/cancel` | player                    | Cancel own booking                                                     |
| GET                             | `/bookings/:id`                         | player                    | Get booking detail                                                     |

---

## 11. What Exists in DB but Not Yet in API

These tables were designed and migrated but have **no corresponding NestJS module, controller, or service** yet. They represent planned future features.

### `reviews`

Schema: links a user to a match, with a rating and comment. Enums for review type and status exist in the database. No API endpoint exists.

**Intended purpose:** Post-match reviews by players. Likely to feed a venue/match rating system.

### `notifications`

Schema: notification records with type, channel, recipient, content, read status. Enums for `notification_type` and `notification_channel` exist.

**Intended purpose:** In-app or push notifications for events like booking confirmation, waitlist promotion, match cancellation. Currently the system sends emails directly (Resend) from service methods without persisting a notification record.

### Wallet Top-Up

The `wallet_transactions` table supports `topup` and `credit` types. The wallet balance mechanism is fully in place. However, there is no HTTP endpoint for a player to add money to their wallet. This is expected to be implemented via a Stripe or similar payment gateway integration.

---

_Last updated: 2026-04-05 | Status: PRE-PRODUCTION_
