# Sportbooker — Complete Business Domain Guide

> **What this project is:** A multi-tenant sports booking platform. Each tenant is a sports club or organiser. Players book spots in matches, pay from an internal wallet, and can join a waitlist. Tenant staff manage venues and matches. A platform-level super admin manages all tenants.

---

## Table of Contents

1. [The Business in One Paragraph](#1-the-business-in-one-paragraph)
2. [Core Concepts Glossary](#2-core-concepts-glossary)
3. [Multi-Tenancy Model](#3-multi-tenancy-model)
4. [Roles and Permissions](#4-roles-and-permissions)
5. [Entity Reference](#5-entity-reference)
6. [Role Lifecycles](#6-role-lifecycles)
   - [Super Admin](#61-super-admin-lifecycle)
   - [Tenant Admin](#62-tenant-admin-lifecycle)
   - [Tenant Staff](#63-tenant-staff-lifecycle)
   - [Player](#64-player-lifecycle)
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

Sportbooker is a **white-label SaaS platform** for sports clubs and organizers (called **tenants**). Each tenant gets their own subdomain (e.g., `acfc.sportbooker.com`). Inside their tenant space, they create **venues** (football pitches, padel courts, etc.), schedule **matches**, and let **players** book spots. Players pay from an internal **wallet**. When a match is full, players join a **waitlist** — they are still charged immediately but get a refund if they never get in. When a confirmed player cancels, the first eligible waitlisted player is automatically promoted. A platform-level **super admin** creates and manages all tenants.

---

## 2. Core Concepts Glossary

| Term | Definition |
|------|-----------|
| **Tenant** | A sports club or organizer that uses the platform. Has its own slug-based subdomain, its own users, venues, and matches. Isolated from other tenants. |
| **Venue** | A physical sports facility owned by a tenant. Has a name, address, map URL, photo, and a list of sport types it supports. |
| **Match** | A scheduled sports game at a venue. Has a date/time, duration, price per player, max player count, and a status. |
| **Booking** | A player's reservation for a match. Can be `confirmed` (active spot) or `pending` (waitlisted). |
| **Waitlist** | When a match is full, new bookings become `pending` (waitlisted). The player is still charged. They get a refund if they cancel or never get promoted. |
| **Wallet** | Each user has an internal balance. All payments go through this wallet — no external payment at booking time. Top-up is a separate future concern (likely Stripe). |
| **Wallet Transaction** | A record of every balance change: `debit` (booking charge), `refund` (cancel/waitlist), `credit` or `topup` (future). |
| **Cancel Cutoff** | A per-tenant setting (`cancel_cutoff_hours`, default 24h). Players cannot cancel a confirmed booking within this many hours of match start. |
| **Position** | Each booking has a position: `field_player` or `goalkeeper`. Maximum 2 confirmed goalkeepers per match. |
| **Soft Delete** | Users are not hard-deleted. They get a `deleted_at` timestamp and `is_active = false`. They cannot log in but their data (bookings, transactions) is preserved. |
| **FIFO Promotion** | When a confirmed spot opens up, the oldest (first-created) eligible pending booking is promoted automatically. |

---

## 3. Multi-Tenancy Model

### How tenants are resolved

Every request to a tenant-scoped route is resolved by the `TenantMiddleware`:

1. Reads the `Host` (or `X-Forwarded-Host`) header.
2. Extracts the subdomain before `APP_DOMAIN` (e.g., `acfc` from `acfc.sportbooker.com`).
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

### Tenant data isolation

Every user, venue, match, and booking is scoped by `tenant_id`. There is no cross-tenant data access in any query.

---

## 4. Roles and Permissions

There are four active roles. They form a strict privilege hierarchy:

```
super_admin (4)
    └── tenant_admin (3)
            └── tenant_staff (2)
                    └── player (1)
```

### Permission Matrix

| Action | super_admin | tenant_admin | tenant_staff | player |
|--------|:-----------:|:------------:|:------------:|:------:|
| Manage tenants (CRUD, activate/deactivate) | ✅ | ❌ | ❌ | ❌ |
| List all users in tenant | ✅ | ✅ | ✅ | ❌ |
| List deleted users (`includeDeleted`) | ✅ | ✅ | ❌ | ❌ |
| View own profile | ✅ | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ | ✅ |
| Assign/change user roles | ✅ | ✅ (except super_admin users) | ❌ | ❌ |
| Delete own account | ❌ | ❌ | ❌ | ✅ |
| Create venues | ✅ | ✅ | ✅ | ❌ |
| Update venues | ✅ | ✅ | ✅ | ❌ |
| Deactivate venues | ✅ | ✅ | ❌ | ❌ |
| Activate venues | ✅ | ✅ | ✅ | ❌ |
| Create matches | ✅ | ✅ | ✅ | ❌ |
| Update matches | ✅ | ✅ | ✅ | ❌ |
| Cancel matches | ✅ | ✅ | ❌ | ❌ |
| Create bookings | ❌ | ❌ | ❌ | ✅ |
| Cancel own booking | ❌ | ❌ | ❌ | ✅ |
| View own bookings | ❌ | ❌ | ❌ | ✅ |
| View own wallet | ❌ | ❌ | ❌ | ✅ |

### Role Assignment Rules

- Only `super_admin`, `tenant_admin` can call `PATCH /users/:id/role`.
- Assignable roles are limited to: `tenant_admin`, `tenant_staff`, `player`. You can never assign `super_admin` through the API.
- A user cannot demote themselves (self-assignment to a lower role is blocked).
- `tenant_admin` cannot modify users who are `super_admin`.
- Super admin users are **never returned** in the tenant user list (the SQL filters them out).

---

## 5. Entity Reference

### `tenants`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `name` | text | Display name |
| `slug` | text | Unique; used for subdomain; validated against reserved slugs |
| `is_active` | boolean | Inactive = 403 on all tenant routes |
| `timezone` | text | Default: `Asia/Dubai` |
| `logo_url` | text | Optional |
| `cancel_cutoff_hours` | integer | Default: 24. Minimum hours before match start a player can cancel a confirmed booking. |
| `created_at`, `updated_at` | timestamp | — |

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants; unique per tenant per email |
| `email` | text | Unique per `(tenant_id, email)` |
| `password_hash` | text | bcrypt |
| `role` | `user_role` enum | `super_admin`, `tenant_admin`, `tenant_staff`, `player` |
| `name` | text | Display name |
| `phone` | text | Optional |
| `photo_url` | text | Optional |
| `wallet_balance` | numeric | Default: 0 |
| `is_active` | boolean | Inactive users cannot log in |
| `deleted_at` | timestamp | Soft delete marker |
| `created_at`, `updated_at` | timestamp | — |

### `venues`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `name` | text | Unique per tenant |
| `address` | text | — |
| `maps_url` | text | Optional Google Maps link |
| `picture_url` | text | Required (upload or URL) |
| `sport_types` | `TEXT[]` | Array; CHECK constraint: must be subset of `{football, padel, cricket, generic}`, minimum 1 |
| `is_active` | boolean | — |
| `created_at`, `updated_at` | timestamp | — |

### `matches`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `venue_id` | UUID | FK → venues |
| `title` | text | — |
| `sport_type` | `sport_type` enum | One of the valid sport types |
| `scheduled_at` | timestamp | Must be in the future on create/update |
| `duration_mins` | integer | ≥ 1 |
| `price_per_player` | numeric | — |
| `max_players` | integer | — |
| `status` | `match_status` enum | Default: `upcoming` |
| `created_at`, `updated_at` | timestamp | — |

Unique constraint: `(venue_id, scheduled_at)` — two matches cannot start at the exact same time at the same venue. Overlap detection in code extends this to prevent time-window collisions.

### `bookings`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `match_id` | UUID | FK → matches |
| `user_id` | UUID | FK → users |
| `status` | `booking_status` enum | `pending` (waitlist), `confirmed`, `cancelled` |
| `paid_amount` | numeric | Amount deducted from wallet on booking. Refunded on cancel or match cancel. |
| `position` | `booking_position` enum | `field_player` or `goalkeeper` |
| `cancelled_at` | timestamp | Set on cancel |
| `refunded_at` | timestamp | Set when wallet refund is issued |
| `created_at`, `updated_at` | timestamp | — |

Partial unique index: `(match_id, user_id)` where `status IN ('pending', 'confirmed')` — a player can only have one active booking per match (cancelled bookings do not block re-booking).

### `wallet_transactions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `amount` | numeric | Always positive; direction implied by `type` |
| `type` | `wallet_tx_type` enum | `debit`, `refund`, `credit`, `topup` |
| `reference_id` | UUID | Optional; links to the booking that caused the transaction |
| `created_at` | timestamp | — |

### `refresh_tokens`

Rotating refresh tokens stored hashed. On login a new token is issued; on refresh the old is rotated; on logout/reset-password all tokens for that user are revoked.

### `password_reset_tokens`

Single-use reset tokens. `used_at` marks consumption. Linked to user. `POST /auth/reset-password` consumes the token and revokes all refresh tokens for that user.

---

## 6. Role Lifecycles

### 6.1 Super Admin Lifecycle

The super admin is a platform operator. They exist outside any tenant but can operate within tenant-scoped routes.

```
[Created manually in seed / DB]
        │
        ▼
    Logs in via POST /auth/login
    (on any tenant Host, or directly)
        │
        ▼
    Manages tenants via /admin/tenants
    ┌─────────────────────────────────────────┐
    │  Create tenant (POST /admin/tenants)    │
    │  View all tenants (GET /admin/tenants)  │
    │  View single tenant (GET ./:id)         │
    │  Update tenant (PATCH ./:id)            │
    │  Deactivate tenant (POST ./:id/deactivate) │
    │  Activate tenant (POST ./:id/activate)  │
    └─────────────────────────────────────────┘
        │
        ▼
    Can also use all tenant-scoped routes
    (with a valid tenant Host)
    ┌─────────────────────────────────────────┐
    │  Full user management                   │
    │  Full venue management                  │
    │  Full match management                  │
    │  (Cannot book — booking is player-only) │
    └─────────────────────────────────────────┘
        │
        ▼
    Never listed in GET /users results
    (SQL filters out super_admin rows)
```

**Key constraints:**
- Cannot be assigned to any user through the API (not in `ASSIGNABLE_ROLE_VALUES`).
- Their user rows are hidden from tenant user lists.
- Full privileges on all admin and tenant routes.

---

### 6.2 Tenant Admin Lifecycle

The tenant admin is the primary operator of a tenant. They configure the space and manage staff and players.

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
    │    └─ Cannot modify super_admin users               │
    │    └─ Cannot assign super_admin role                │
    │    └─ Cannot demote self                            │
    └─────────────────────────────────────────────────────┘
        │
        ▼
    Manages own profile (GET/PATCH /users/me)
```

**Key constraints:**
- Cannot delete their own account (only `player` can via `DELETE /users/me`).
- Cannot modify super_admin users.
- Cannot assign the `super_admin` role.
- Full venue and match management including destructive actions (deactivate, cancel).

---

### 6.3 Tenant Staff Lifecycle

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

### 6.4 Player Lifecycle

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
    │  - Must be ≥ cancel_cutoff_hours before start  │
    │  - NO REFUND for confirmed cancellation        │
    │  - Triggers FIFO waitlist promotion (async)    │
    │                                                │
    │  Cancel pending (waitlist) booking:            │
    │  - Can cancel at any time                      │
    │  - FULL REFUND to wallet                       │
    │  - No FIFO promotion triggered                 │
    └────────────────────────────────────────────────┘
        │
        ▼
    Match day
    ┌────────────────────────────────────────────────┐
    │  Confirmed → plays the match                   │
    │  Pending → may have been promoted by now       │
    │  If still pending at match time → no refund    │
    │    needed (already refunded logic TBD, see §8) │
    └────────────────────────────────────────────────┘
        │
        ▼
    Can view own history: GET /users/me/bookings
    Can view own wallet: GET /users/me/wallet
        │
        ▼
    Can delete own account: DELETE /users/me
    ┌────────────────────────────────────────────────┐
    │  BLOCKED if player has confirmed bookings       │
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
super_admin → POST /admin/tenants
    body: { name, slug, timezone?, logo_url?, cancel_cutoff_hours? }
        │
        ▼
    Validation:
    - slug not in RESERVED_SLUGS list
    - slug unique in DB
        │
        ▼
    Tenant created: is_active = true
    Default timezone: Asia/Dubai
    Default cancel_cutoff_hours: 24
        │
        ▼
    Subdomain now resolves: slug.APP_DOMAIN
        │
        ▼
    Tenant admin account created (manually or seeded)
        │
        ▼
    Tenant admin logs in on slug.APP_DOMAIN
        │
        ▼
    Creates venues → creates matches → invites players
```

**Deactivating a tenant:**
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
│     │            DEACTIVATE (admin only)                        │
│     │            └─ Blocked if upcoming/in-progress matches     │
│     │               (returns 409 with match count)              │
│     │                    │                                      │
│     │                    ▼                                      │
│     │              is_active=false                              │
│     │              └─ New bookings blocked (venue inactive)     │
│     │                    │                                      │
│     │                    ▼                                      │
│     │              ACTIVATE (admin or staff)                    │
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
│  scheduled → upcoming → in_progress → completed                  │
│                   │                                              │
│                   └──────────────────► cancelled                 │
│                                                                  │
│  New matches default to: upcoming                                │
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

**Cancel match (tenant_admin only):**

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

**Browse matches (public, tenant-scoped):**
- Only `status = 'upcoming'` matches are returned.
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
    Check: now() < scheduled_at - cancel_cutoff_hours
           (must cancel before cutoff window)
    If within cutoff window → 422 error (too late to cancel)
    Otherwise:
      Set booking: status=cancelled, cancelled_at=now
      NO wallet refund
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

| Event | Wallet Change | Transaction Type |
|-------|--------------|-----------------|
| Book a match (confirmed) | − price_per_player | `debit` |
| Book a match (waitlisted) | − price_per_player | `debit` |
| Cancel confirmed booking | no change | — |
| Cancel pending (waitlist) booking | + paid_amount | `refund` |
| Match cancelled by admin | + paid_amount (all bookings) | `refund` |
| FIFO promotion (prepaid) | no change | — |
| Future: top-up | + amount | `topup` |
| Future: credit | + amount | `credit` |

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
POST /auth/login (tenant Host required)
body: { email, password }
        │
        ▼
  Find user by (tenant_id, email)
  Check: is_active=true, deleted_at=null
  Verify password (bcrypt)
  Issue JWT: { sub: userId, role, tenantId }
  Issue opaque refresh token (stored hashed in refresh_tokens)
  Return: { accessToken, refreshToken, user }

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
  Send email via SendGrid (or log to console if unconfigured)

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
[Self-register] OR [Seeded]
        │
        ▼
    is_active=true, deleted_at=null
        │
        ├─── Role can be changed by tenant_admin / super_admin
        │    (PATCH /users/:id/role)
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
               (tenant_admin+ only)
             → Historical bookings / wallet data preserved in DB
```

---

## 8. Business Rules Enforced in Code

| Rule | Where enforced | Error |
|------|---------------|-------|
| Tenant slug not reserved | `TenantsService` constants | 409 |
| Inactive tenant | `TenantMiddleware` | 403 |
| JWT tenant mismatch | `TenantUserMatchGuard` | 403 |
| User must be active + not deleted to log in | `AuthService` | 401 |
| Duplicate email per tenant | DB unique constraint | 409 |
| Duplicate active booking (user + match) | DB partial unique index | 409 |
| Booking must be in the future | `BookingsRepository` | 422 |
| Wallet must have sufficient balance | `BookingsRepository` | 422 |
| Cancel confirmed booking only before cutoff | `BookingsRepository` | 422 |
| Cannot delete account with confirmed upcoming bookings | `UsersService` | 409 |
| Venue deactivation blocked by active matches | `VenuesService` | 409 |
| Match overlap at same venue | `MatchesRepository` | 409 |
| Max 2 confirmed goalkeepers | `BookingsRepository` | → waitlist (not hard reject) |
| `max_players` cannot decrease below confirmed count | `MatchesService` | 422 |
| Cannot update cancelled match | `MatchesService` | 422 |
| Cannot assign `super_admin` role via API | `UsersService` | 403 |
| Cannot demote self | `UsersService` | 403 |
| `tenant_admin` cannot modify `super_admin` users | `UsersService` | 403 |
| Venue `sport_types` restricted to 4 values | DB CHECK constraint | 422 |

---

## 9. Statuses and Enums Reference

### `match_status`

| Value | Meaning |
|-------|---------|
| `scheduled` | Created but not yet imminent (legacy; new matches default to `upcoming`) |
| `upcoming` | Open for browsing and booking |
| `in_progress` | Match is currently happening |
| `completed` | Match finished |
| `cancelled` | Cancelled by admin; all bookings refunded |

Only `upcoming` matches appear in `GET /matches` (browse). Other statuses visible in detail view.

### `booking_status`

| Value | Meaning |
|-------|---------|
| `confirmed` | Player has an active spot; wallet was charged |
| `pending` | Player is on the waitlist; wallet was charged (prepaid) |
| `cancelled` | Booking cancelled (by player or match cancel) |

### `booking_position`

| Value | Meaning |
|-------|---------|
| `field_player` | Regular outfield position |
| `goalkeeper` | Goalkeeper position; max 2 confirmed per match |

### `wallet_tx_type`

| Value | API label | Meaning |
|-------|-----------|---------|
| `debit` | `"deduction"` | Wallet charged for a booking |
| `refund` | `"refund"` | Wallet credited back (cancel / match cancel) |
| `credit` | `"credit"` | Manual credit (future use) |
| `topup` | `"topup"` | Player adds money (future Stripe integration) |

### `sport_type` (matches)

`football`, `basketball`, `tennis`, `volleyball`, `padel`, `cricket`, `generic`, `other`

### Venue `sport_types` (tags — subset)

`football`, `padel`, `cricket`, `generic`

### `user_role`

| Value | Rank | Notes |
|-------|------|-------|
| `super_admin` | 4 | Platform operator; not assignable via API |
| `tenant_admin` | 3 | Full tenant management |
| `tenant_staff` | 2 | Operational management (no destructive actions) |
| `player` | 1 | End customer; default on register |

---

## 10. API Surface Overview

All routes below are tenant-scoped (require correct Host header) unless marked **[PLATFORM]**.

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/` | public | Health check |
| **Auth** | | | |
| POST | `/auth/register` | public | Creates player |
| POST | `/auth/login` | public | Returns JWT + refresh token |
| POST | `/auth/forgot-password` | public | Anti-enumeration; always 200 |
| POST | `/auth/reset-password` | public | Consumes token |
| POST | `/auth/refresh` | public | [PLATFORM] no Host needed |
| POST | `/auth/logout` | authenticated | Revokes refresh tokens |
| **Admin (Platform)** [PLATFORM] | | | |
| GET | `/admin/tenants` | super_admin | List all tenants |
| POST | `/admin/tenants` | super_admin | Create tenant |
| GET | `/admin/tenants/:id` | super_admin | Get tenant |
| PATCH | `/admin/tenants/:id` | super_admin | Update tenant |
| POST | `/admin/tenants/:id/deactivate` | super_admin | Deactivate |
| POST | `/admin/tenants/:id/activate` | super_admin | Activate |
| **Users** | | | |
| GET | `/users` | admin, staff | List tenant users |
| GET | `/users/me` | any | Own profile |
| PATCH | `/users/me` | any | Update own profile |
| DELETE | `/users/me` | player | Soft delete (if no upcoming bookings) |
| GET | `/users/me/bookings` | player | Own booking history |
| GET | `/users/me/wallet` | player | Own wallet + transactions |
| GET | `/users/:id` | admin, staff | View any user |
| PATCH | `/users/:id/role` | admin | Change user role |
| **Venues** | | | |
| GET | `/venues` | public | Browse active venues |
| GET | `/venues/:id` | any | Venue detail |
| POST | `/venues` | admin, staff | Create venue (multipart) |
| PATCH | `/venues/:id` | admin, staff | Update venue |
| POST | `/venues/:id/activate` | admin, staff | Activate |
| POST | `/venues/:id/deactivate` | admin | Deactivate (blocked if matches) |
| **Matches** | | | |
| GET | `/matches` | public | Browse upcoming matches |
| GET | `/matches/:id` | any | Match detail + roster |
| POST | `/matches` | admin, staff | Create match |
| PATCH | `/matches/:id` | admin, staff | Update match |
| POST | `/matches/:id/cancel` | admin | Cancel match + refund all |
| **Bookings** | | | |
| POST | `/matches/:matchId/bookings` | player | Book or join waitlist |
| POST | `/matches/:matchId/bookings/:id/cancel` | player | Cancel own booking |
| GET | `/bookings/:id` | player | Get booking detail |

---

## 11. What Exists in DB but Not Yet in API

These tables were designed and migrated but have **no corresponding NestJS module, controller, or service** yet. They represent planned future features.

### `reviews`

Schema: links a user to a match, with a rating and comment. Enums for review type and status exist in the database. No API endpoint exists.

**Intended purpose:** Post-match reviews by players. Likely to feed a venue/match rating system.

### `notifications`

Schema: notification records with type, channel, recipient, content, read status. Enums for `notification_type` and `notification_channel` exist.

**Intended purpose:** In-app or push notifications for events like booking confirmation, waitlist promotion, match cancellation. Currently the system sends emails directly (SendGrid) from service methods without persisting a notification record.

### Wallet Top-Up

The `wallet_transactions` table supports `topup` and `credit` types. The wallet balance mechanism is fully in place. However, there is no HTTP endpoint for a player to add money to their wallet. This is expected to be implemented via a Stripe or similar payment gateway integration.

---

*Last updated: 2026-04-04 | Status: PRE-PRODUCTION*
