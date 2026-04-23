# HTTP API endpoints

Reference list of all NestJS controller routes in this repo. **No global path prefix** — paths are from the app root (e.g. `http://localhost:3000/users/me`).

For **interactive docs**, run the app in non-production and open Swagger (see `src/main.ts`).

---

## Conventions

| Topic              | Behavior                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth**           | Most routes require `Authorization: Bearer <access_token>`. Routes marked **Public** skip JWT (see `@Public()` on handlers).                                                                                                                                                                           |
| **Tenant context** | Tenant is resolved from the **Host** header (subdomain), e.g. `acfc.localhost:3000`. Some paths are **excluded** from tenant middleware (no tenant required on the request): `GET /`, `POST /test-validation`, `POST /auth/refresh`, `POST /auth/reset-password`, `admin/tenants/*`, `GET /uploads/*`. |
| **Roles**          | Where **Roles** is listed, `RolesGuard` requires `user.role` to be one of those values. If a route has no role list, any authenticated user passes the role guard (still subject to JWT + tenant guards).                                                                                              |
| **Static files**   | `GET /uploads/...` serves files from the `uploads/` directory (not a controller; excluded from tenant middleware).                                                                                                                                                                                     |

---

## App

| Method | Path               | Auth   | Roles | Notes                         |
| ------ | ------------------ | ------ | ----- | ----------------------------- |
| `GET`  | `/`                | Public | —     | Health / hello                |
| `POST` | `/test-validation` | Public | —     | DTO validation smoke test     |
| `GET`  | `/protected`       | JWT    | —     | Returns `{ user }` from token |

---

## Auth (`/auth`)

| Method | Path                    | Auth   | Roles | Notes                                                                                                                           |
| ------ | ----------------------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/auth/register`        | Public | —     | Requires tenant Host; rate limited. Body: `phone` (E.164 string, e.g. `"+963998163901"`); stored as `BIGINT` digits without `+` |
| `POST` | `/auth/login`           | Public | —     | Requires tenant Host; rate limited                                                                                              |
| `POST` | `/auth/forgot-password` | Public | —     | Requires tenant Host; rate limited                                                                                              |
| `POST` | `/auth/reset-password`  | Public | —     | Tenant middleware excluded                                                                                                      |
| `POST` | `/auth/refresh`         | Public | —     | Tenant middleware excluded                                                                                                      |
| `POST` | `/auth/logout`          | JWT    | —     | Revokes refresh for user                                                                                                        |

---

## Admin — tenants (`/admin/tenants`)

Tenant middleware **excluded** for this subtree. All routes require JWT + **`super_admin`**.

| Method  | Path                            | Roles       |
| ------- | ------------------------------- | ----------- |
| `GET`   | `/admin/tenants`                | super_admin |
| `GET`   | `/admin/tenants/:id`            | super_admin |
| `POST`  | `/admin/tenants`                | super_admin |
| `PATCH` | `/admin/tenants/:id`            | super_admin |
| `POST`  | `/admin/tenants/:id/deactivate` | super_admin |
| `POST`  | `/admin/tenants/:id/activate`   | super_admin |

Deactivate sets `is_active = false`. The last active tenant may be deactivated; until at least one tenant is active again, tenant Host traffic for those subdomains returns 403. Activate sets `is_active = true` again (mirror of deactivate).

---

## Users (`/users`)

Requires JWT and tenant Host (unless you are only hitting routes that do not need tenant — all of these are tenant-scoped).

Controller default roles: `super_admin`, `tenant_admin` — **overridden per handler** where noted.

| Method   | Path                  | Roles (handler)                                   | Notes                                                                                                                                                                                                         |
| -------- | --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/users`              | tenant_admin, tenant_staff                        | Paginated tenant user list                                                                                                                                                                                    |
| `GET`    | `/users/me`           | super_admin, tenant_admin, tenant_staff, player   | Current user profile — includes player profile fields + computed `stats` block                                                                                                                                |
| `GET`    | `/users/me/bookings`  | super_admin, tenant_admin, tenant_staff, player   | My bookings                                                                                                                                                                                                   |
| `GET`    | `/users/me/wallet`    | super_admin, tenant_admin, tenant_staff, player   | Wallet + transactions                                                                                                                                                                                         |
| `PATCH`  | `/users/me`           | super_admin, tenant_admin, tenant_staff, player   | Update profile (`name`, `email`, `phone` as E.164 string e.g. `"+963998163901"`, `photoUrl`); email unique per tenant, normalized to lowercase                                                                |
| `PATCH`  | `/users/me`           | super_admin, tenant_admin, tenant_staff, player   | Update profile (`name`, `email`, `phone`, `photoUrl`, `dateOfBirth`, `nationality`, `preferredLanguage`, `skillLevel`, `preferredPosition`, `dominantFoot`); email unique per tenant, normalized to lowercase |
| `DELETE` | `/users/me`           | **player**                                        | Soft-delete my account                                                                                                                                                                                        |
| `GET`    | `/users/:userId`      | tenant_admin, tenant_staff                        | User detail in tenant (UUID)                                                                                                                                                                                  |
| `PATCH`  | `/users/:userId/role` | **super_admin**, **tenant_admin** (class default) | Assign role                                                                                                                                                                                                   |

> Register `GET /users/me` before parametric `GET /users/:userId` so `me` is not parsed as a UUID.

---

## Venues (`/venues`)

| Method  | Path                     | Roles                        | Notes                                                                              |
| ------- | ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------- |
| `GET`   | `/venues`                | _(none — any authenticated)_ | Paginated active venues (`page`, `limit`; default limit 50). Optional `sportType`. |
| `GET`   | `/venues/:id`            | _(none)_                     | Venue detail                                                                       |
| `PATCH` | `/venues/:id`            | tenant_admin, tenant_staff   | Partial update (does not toggle `is_active`; use activate/deactivate)              |
| `POST`  | `/venues/:id/deactivate` | tenant_admin                 | Deactivate venue (409 if upcoming/ongoing matches)                                 |
| `POST`  | `/venues/:id/activate`   | tenant_admin                 | Activate a deactivated venue                                                       |
| `POST`  | `/venues`                | tenant_admin, tenant_staff   | Create venue (multipart/form-data; `picture` file or `pictureUrl` required)        |

---

## Matches (`/matches`)

Player-facing browse. Tenant Host required.

| Method  | Path                  | Roles                        | Notes                                                                  |
| ------- | --------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `GET`   | `/matches`            | _(none — any authenticated)_ | List **upcoming** matches only (no cancelled, no past)                 |
| `GET`   | `/matches/:id`        | _(none)_                     | Match detail (includes `venueName`, `venueAddress`, `venuePictureUrl`) |
| `PATCH` | `/matches/:id`        | tenant_admin, tenant_staff   | Update match                                                           |
| `POST`  | `/matches/:id/cancel` | tenant_admin                 | Cancel + refunds                                                       |
| `POST`  | `/matches`            | tenant_admin, tenant_staff   | Create match                                                           |

### `GET /matches` — query parameters

Filters are applied first, then **server-side** `sortBy`, then `page` / `limit`. The `total` field is the row count **after filters** (sort does not change `total`). Clients should not re-sort or re-filter `items` for pagination to stay correct.

| Param        | Type                                                                 | Default              | Description |
| ------------ | -------------------------------------------------------------------- | -------------------- | ----------- |
| `page`       | integer ≥ 1                                                          | `1`                  | Page index. |
| `limit`      | integer 1–100                                                        | `20`                 | Page size. |
| `sportType`  | `football` \| `padel` \| `cricket` \| `generic`                      | _(none)_             | Filter by sport. |
| `venueId`    | UUID                                                                 | _(none)_             | Filter by venue. |
| `date`       | `YYYY-MM-DD`                                                         | _(none)_             | Tenant-local calendar day of `scheduled_at`. |
| `available`  | boolean                                                              | _(none)_             | If `true`, only matches with at least one spot left. |
| `sortBy`     | see below                                                            | `scheduled_at_asc`   | Sort the **full** filtered set before slicing the page. |
| `dayOfWeek`  | integer(s) **1–7** (ISO weekday), repeatable or comma-separated      | _(none)_             | **1 = Monday … 7 = Sunday** in the tenant timezone. Multiple values are **OR** (match on any listed day). Not the same as JavaScript `Date.getDay()` (0 = Sunday); map e.g. `js === 0 ? 7 : js`. |

**`sortBy` values** (stable tie-break: `match.id` ascending):

- `scheduled_at_asc` / `scheduled_at_desc`
- `price_asc` / `price_desc`
- `spots_remaining_asc` / `spots_remaining_desc`

**Examples:** `GET /matches?sortBy=price_asc&limit=12` — page 1 is the 12 cheapest in the filtered universe. `GET /matches?dayOfWeek=6&dayOfWeek=7` or `?dayOfWeek=6,7` — Saturdays or Sundays only.

---

## Tenant — Matches (`/tenant/matches`)

Operator match management. Tenant Host required. All routes require JWT + `super_admin`, `tenant_admin`, or `tenant_staff`.

| Method | Path                          | Roles                                   | Notes                                                                                                     |
| ------ | ----------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET`  | `/tenant/matches`             | super_admin, tenant_admin, tenant_staff | All matches across **all statuses**; full filtering + pagination                                          |
| `POST` | `/tenant/matches/:id/results` | super_admin, tenant_admin, tenant_staff | Submit final result + per-player stats for a completed match; one submission per match (409 if duplicate) |
| `GET`  | `/tenant/matches/:id/results` | super_admin, tenant_admin, tenant_staff | Fetch submitted results for a match; 404 if not yet submitted                                             |

### Query parameters

| Param       | Type                                                      | Default  | Description                               |
| ----------- | --------------------------------------------------------- | -------- | ----------------------------------------- |
| `status`    | `upcoming` \| `in_progress` \| `completed` \| `cancelled` | _(all)_  | Filter by computed status                 |
| `dateFrom`  | `YYYY-MM-DD`                                              | _(none)_ | `scheduled_at` ≥ dateFrom (UTC date)      |
| `dateTo`    | `YYYY-MM-DD`                                              | _(none)_ | `scheduled_at` ≤ dateTo (UTC date)        |
| `venueId`   | UUID                                                      | _(none)_ | Filter by venue                           |
| `sportType` | `football` \| `padel` \| `cricket` \| `generic`           | _(none)_ | Filter by sport                           |
| `search`    | string (max 100)                                          | _(none)_ | Title substring, case-insensitive (ILIKE) |
| `page`      | number ≥ 1                                                | `1`      | Pagination page                           |
| `limit`     | number 1–100                                              | `20`     | Page size                                 |

### Response item fields

| Field            | Type     | Notes                                                         |
| ---------------- | -------- | ------------------------------------------------------------- |
| `id`             | UUID     |                                                               |
| `title`          | string   |                                                               |
| `sportType`      | enum     |                                                               |
| `scheduledAt`    | ISO 8601 |                                                               |
| `durationMins`   | number   |                                                               |
| `pricePerPlayer` | number   |                                                               |
| `maxCapacity`    | number   |                                                               |
| `status`         | string   | Computed: `upcoming`, `in_progress`, `completed`, `cancelled` |
| `venueId`        | UUID     |                                                               |
| `venueName`      | string   |                                                               |
| `confirmedCount` | number   | Confirmed bookings                                            |
| `waitlistCount`  | number   | Pending (waitlisted) bookings                                 |
| `spotsRemaining` | number   | `maxCapacity − confirmedCount`                                |
| `createdAt`      | ISO 8601 |                                                               |
| `updatedAt`      | ISO 8601 |                                                               |

Results are ordered by `scheduledAt DESC`.

---

## Bookings

### Under `/matches` (`BookingsController`)

| Method | Path                                           | Roles      | Notes                                                        |
| ------ | ---------------------------------------------- | ---------- | ------------------------------------------------------------ |
| `POST` | `/matches/:matchId/bookings/:bookingId/cancel` | **player** | Self-cancel confirmed booking (until start; refund if ≥ tenant `cancel_cutoff_hours` before start) |
| `POST` | `/matches/:matchId/bookings`                   | **player** | Book or waitlist                                             |

> Register `.../bookings/:bookingId/cancel` before `.../bookings` so routes resolve correctly.

### Under `/bookings` (`BookingDetailController`)

| Method | Path                   | Roles                                           | Notes                                            |
| ------ | ---------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `GET`  | `/bookings/:bookingId` | super_admin, tenant_admin, tenant_staff, player | Own booking or tenant admin/staff; match + venue |

---

## Summary counts

| Area             | Count  |
| ---------------- | ------ |
| App              | 3      |
| Auth             | 6      |
| Admin tenants    | 5      |
| Users            | 9      |
| Venues           | 6      |
| Matches          | 5      |
| Tenant — Matches | 3      |
| Bookings         | 3      |
| **Total**        | **40** |

---

_Generated from controller files under `src/`. If something drifts, compare with `@Controller` + `@Get`/`@Post`/… in `_.controller.ts`.\*
