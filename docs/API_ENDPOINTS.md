# HTTP API endpoints

Reference list of all NestJS controller routes in this repo. **No global path prefix** — paths are from the app root (e.g. `http://localhost:3000/users/me`).

For **interactive docs**, run the app in non-production and open Swagger (see `src/main.ts`).

---

## Conventions

| Topic | Behavior |
|--------|----------|
| **Auth** | Most routes require `Authorization: Bearer <access_token>`. Routes marked **Public** skip JWT (see `@Public()` on handlers). |
| **Tenant context** | Tenant is resolved from the **Host** header (subdomain), e.g. `acfc.localhost:3000`. Some paths are **excluded** from tenant middleware (no tenant required on the request): `GET /`, `POST /test-validation`, `POST /auth/refresh`, `POST /auth/reset-password`, `admin/tenants/*`, `GET /uploads/*`. |
| **Roles** | Where **Roles** is listed, `RolesGuard` requires `user.role` to be one of those values. If a route has no role list, any authenticated user passes the role guard (still subject to JWT + tenant guards). |
| **Static files** | `GET /uploads/...` serves files from the `uploads/` directory (not a controller; excluded from tenant middleware). |

---

## App

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|--------|
| `GET` | `/` | Public | — | Health / hello |
| `POST` | `/test-validation` | Public | — | DTO validation smoke test |
| `GET` | `/protected` | JWT | — | Returns `{ user }` from token |

---

## Auth (`/auth`)

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|--------|
| `POST` | `/auth/register` | Public | — | Requires tenant Host; rate limited |
| `POST` | `/auth/login` | Public | — | Requires tenant Host; rate limited |
| `POST` | `/auth/forgot-password` | Public | — | Requires tenant Host; rate limited |
| `POST` | `/auth/reset-password` | Public | — | Tenant middleware excluded |
| `POST` | `/auth/refresh` | Public | — | Tenant middleware excluded |
| `POST` | `/auth/logout` | JWT | — | Revokes refresh for user |

---

## Admin — tenants (`/admin/tenants`)

Tenant middleware **excluded** for this subtree. All routes require JWT + **`super_admin`**.

| Method | Path | Roles |
|--------|------|--------|
| `GET` | `/admin/tenants` | super_admin |
| `GET` | `/admin/tenants/:id` | super_admin |
| `POST` | `/admin/tenants` | super_admin |
| `PATCH` | `/admin/tenants/:id` | super_admin |
| `POST` | `/admin/tenants/:id/deactivate` | super_admin |

---

## Users (`/users`)

Requires JWT and tenant Host (unless you are only hitting routes that do not need tenant — all of these are tenant-scoped).

Controller default roles: `super_admin`, `tenant_admin` — **overridden per handler** where noted.

| Method | Path | Roles (handler) | Notes |
|--------|------|-----------------|--------|
| `GET` | `/users` | tenant_admin, tenant_staff | Paginated tenant user list |
| `GET` | `/users/me` | super_admin, tenant_admin, tenant_staff, player | Current user profile |
| `GET` | `/users/me/bookings` | super_admin, tenant_admin, tenant_staff, player | My bookings |
| `GET` | `/users/me/wallet` | super_admin, tenant_admin, tenant_staff, player | Wallet + transactions |
| `PATCH` | `/users/me` | super_admin, tenant_admin, tenant_staff, player | Update my profile |
| `DELETE` | `/users/me` | **player** | Soft-delete my account |
| `GET` | `/users/:userId` | tenant_admin, tenant_staff | User detail in tenant (UUID) |
| `PATCH` | `/users/:userId/role` | **super_admin**, **tenant_admin** (class default) | Assign role |

> Register `GET /users/me` before parametric `GET /users/:userId` so `me` is not parsed as a UUID.

---

## Venues (`/venues`)

| Method | Path | Roles | Notes |
|--------|------|-------|--------|
| `GET` | `/venues` | *(none — any authenticated)* | List/browse |
| `GET` | `/venues/:id` | *(none)* | Venue detail |
| `PATCH` | `/venues/:id` | tenant_admin, tenant_staff | Update venue |
| `POST` | `/venues/:id/deactivate` | tenant_admin | Deactivate venue |
| `POST` | `/venues` | tenant_admin, tenant_staff | Create (JSON) |
| `POST` | `/venues/upload` | tenant_admin, tenant_staff | Create (multipart + optional image) |

---

## Matches (`/matches`)

| Method | Path | Roles | Notes |
|--------|------|-------|--------|
| `GET` | `/matches` | *(none)* | List upcoming matches |
| `GET` | `/matches/:id` | *(none)* | Match detail |
| `PATCH` | `/matches/:id` | tenant_admin, tenant_staff | Update match |
| `POST` | `/matches/:id/cancel` | tenant_admin | Cancel + refunds |
| `POST` | `/matches` | tenant_admin, tenant_staff | Create match |

---

## Bookings

### Under `/matches` (`BookingsController`)

| Method | Path | Roles | Notes |
|--------|------|-------|--------|
| `POST` | `/matches/:matchId/bookings/:bookingId/cancel` | **player** | Self-cancel confirmed booking (≥24h before match, no refund) |
| `POST` | `/matches/:matchId/bookings` | **player** | Book or waitlist |

> Register `.../bookings/:bookingId/cancel` before `.../bookings` so routes resolve correctly.

### Under `/bookings` (`BookingDetailController`)

| Method | Path | Roles | Notes |
|--------|------|-------|--------|
| `GET` | `/bookings/:bookingId` | super_admin, tenant_admin, tenant_staff, player | Own booking or tenant admin/staff; match + venue |

---

## Summary counts

| Area | Count |
|------|------|
| App | 3 |
| Auth | 6 |
| Admin tenants | 5 |
| Users | 9 |
| Venues | 6 |
| Matches | 5 |
| Bookings | 3 |
| **Total** | **37** |

---

*Generated from controller files under `src/`. If something drifts, compare with `@Controller` + `@Get`/`@Post`/… in `*.controller.ts`.*
