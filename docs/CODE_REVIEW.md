# Code Review: Dirty Code Report

**Date:** 2026-04-11
**Project:** SportBooker
**Status:** Pre-Production

---

## Summary Table

| # | Section | Issue | Severity | Decision |
|---|---------|-------|----------|----------|
| 1-A | Architecture | Wrong match status predicates in SQL | 🔴 Critical | Fix SQL to time-based predicates |
| 1-B | Architecture | X-Forwarded-Host tenant spoofing | 🟠 High | Strip at proxy level |
| 1-C | Architecture | PG_UNIQUE_VIOLATION magic string scattered | 🟡 Medium | Shared constant + typed guard |
| 1-D | Architecture | Two transaction entry points | 🟡 Medium | Verify + unify |
| 2-A | Code Quality | deactivateForTenant duplicates entire sequence | 🟠 High | Strip retry loop |
| 2-B | Code Quality | JWT signing block copy-pasted | 🟡 Medium | Extract generateTokenPair() |
| 2-C | Code Quality | JWT expiry silently falls back to 900s | 🟠 High | Joi regex validator at startup |
| 2-D | Code Quality | Pagination defaults inconsistent, offset math repeated | 🟡 Medium | Shared toOffset() utility |
| 3-A | Tests | Zero E2E tests | 🔴 Critical | Write E2E specs per module |
| 3-B | Tests | No controller unit tests | 🟠 High | Add for auth + bookings |
| 3-C | Tests | No repository tests — complex SQL never executed | 🔴 Critical | Repo integration tests |
| 3-D | Tests | Service specs skip error propagation paths | 🟡 Medium | Test each catch(err) block |
| 4-A | Performance | Waitlist promotion: O(n) queries per player in transaction | 🟠 High | Extract count queries before loop |
| 4-B | Performance | Wallet uses parseFloat() on NUMERIC — loses precision | 🟡 Medium | decimal.js or integer cents |
| 4-C | Performance | Tenant middleware cache has no size limit | 🟢 Low | Defer to production |

---

## Section 1: Architecture

### 1-A 🔴 CRITICAL — Wrong Match Status Predicates (Real Bug)

**Files:**
- `src/venues/venues.repository.ts` lines 204–208, 236–241
- `src/bookings/bookings.repository.ts` line 739

**What happened:**
The `match_status` enum only ever stores two values in the DB: `scheduled` and `cancelled`.
The values `upcoming`, `in_progress`, and `completed` are **computed at query time** from
`scheduled_at + duration_mins` — they are never written to the database column.

This is documented in the migration itself:

```sql
-- database/migrations/001_create_enums.sql
-- Only 'scheduled' and 'cancelled' are stored in the DB.
-- 'upcoming', 'in_progress', 'completed' are computed at query time.
CREATE TYPE match_status AS ENUM ('scheduled', 'cancelled');
```

But `venues.repository.ts` queries against these non-existent stored values:

```sql
-- venues.repository.ts lines 204–208
AND (
  status = 'in_progress'                        -- ❌ never stored, never matches
  OR (
    status IN ('scheduled', 'upcoming')          -- ❌ 'upcoming' never stored
    AND scheduled_at >= now()
  )
)
```

And `bookings.repository.ts` line 739:

```sql
AND m.status NOT IN ('cancelled', 'completed', 'in_progress')  -- ❌ 'completed', 'in_progress' are not enum values
```

**Impact:**
- The `countBlockingMatchesForVenue` check is silently broken. `status = 'in_progress'` never
  matches anything in the DB, so an in-progress match does not block venue deactivation.
- A venue can be deactivated while a match is actively being played.
- The waitlist promotion guard (`bookings.repository.ts` line 739) is weaker than intended —
  the `NOT IN ('completed', 'in_progress')` clause has no effect.

**Fix — use time-based predicates like `matches.repository.ts` does:**

```sql
-- Correct: a match is "blocking" if it is scheduled and hasn't ended yet
status = 'scheduled'
AND scheduled_at + (duration_mins * INTERVAL '1 minute') > now()
```

---

### 1-B 🟠 HIGH — X-Forwarded-Host Tenant Spoofing

**File:** `src/tenant/tenant.middleware.ts` lines ~89–90

**What happened:**
The middleware prefers `X-Forwarded-Host` over `Host` to resolve the tenant slug. If any path
exists where traffic reaches Node.js without passing through the proxy (direct port access,
misconfigured ALB, CI/CD environment, local dev), a client can send a spoofed
`X-Forwarded-Host` header and resolve as a different tenant entirely.

**Fix:** Strip or validate `X-Forwarded-Host` at the proxy (nginx / ALB) before it reaches
the app. Defer to production hardening — low risk in pre-production.

---

### 1-C 🟡 MEDIUM — PG_UNIQUE_VIOLATION Scattered as Magic Strings

**Files:**
- `src/matches/matches.service.ts` — defines its own `const PG_UNIQUE_VIOLATION = '23505'`
- `src/venues/venues.service.ts` — same
- `src/auth/auth.service.ts` — uses the raw string `'23505'` inline (no constant at all)
- `src/bookings/bookings.repository.ts` — same pattern

**What happened:**
Every service that needs to catch a Postgres unique-constraint violation defines or inlines
its own copy of the `'23505'` error code. There is no shared source of truth. Additionally,
the error is cast unsafely everywhere as `err as { code?: string }`.

**Fix:**

1. Create `src/common/constants/pg-errors.ts`:

```typescript
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === PG_UNIQUE_VIOLATION;
}
```

2. Replace all local constants and raw strings with imports from this file.

---

### 1-D 🟡 MEDIUM — Two Transaction Entry Points

**Files:**
- `src/bookings/bookings.repository.ts` — uses `BaseRepository.withTransaction`
- `src/users/users.service.ts` (`deleteMyAccount`) — calls `authRepository.runInTransaction`

**What happened:**
Two different API surfaces exist for starting a DB transaction. Callers need to know which
one to use without any guidance, and the relationship between them is unclear.

**Fix:** Verify that `authRepository.runInTransaction` simply delegates to
`BaseRepository.withTransaction`. If it does, add a JSDoc comment documenting the
delegation. If it does not, unify to one entry point.

---

## Section 2: Code Quality

### 2-A 🟠 HIGH — `deactivateForTenant` Duplicates Its Entire Body

**File:** `src/venues/venues.service.ts` lines 118–197

**What happened:**
The method runs the full check-and-deactivate sequence **twice** back-to-back with
identical logic. This appears to be defensive retry logic against a TOCTOU (time-of-check /
time-of-use) race condition. However:

1. The race is **already handled atomically** inside the repository via a `NOT EXISTS`
   subquery in the `UPDATE` statement.
2. The service-level retry is **not atomic** — there is still a race window between the two
   attempts.
3. The duplicate adds 3 extra DB round-trips per call and ~50 lines of redundant code.

```typescript
// This exact block runs TWICE:
row = await deactivateVenueForTenantIfNoBlockingMatches(...)
if (row) { return success }
existing = await findVenueRowByIdForTenant(...)
if (!existing) { throw NotFoundException }
if (!existing.is_active) { return alreadyInactive }
blocking = await countBlockingMatchesForVenue(venueId)
if (blocking > 0) { throw ConflictException }
// ... then the entire block again ...
```

**Fix:** Remove the retry loop. One attempt is sufficient:

1. Call `deactivateVenueForTenantIfNoBlockingMatches` (atomic).
2. If it returns `null`, call `findVenueRow` once to distinguish between:
   - Venue not found → `NotFoundException`
   - Venue already inactive → return `alreadyInactive`
   - Blocking matches exist → `ConflictException`

This cuts the method from ~80 lines to ~30 and removes 3 DB queries per call.

---

### 2-B 🟡 MEDIUM — JWT Signing Block Copy-Pasted

**File:** `src/auth/auth.service.ts`

**What happened:**
Both `login()` and `refresh()` independently perform the same three steps:

1. Load `JWT_ACCESS_EXPIRES_IN` from `ConfigService`
2. Call `parseExpiresInToSeconds`
3. Call `jwtService.sign(payload, { expiresIn: ... })`

If the token payload structure or expiry logic ever changes, it must be updated in two places.

**Fix:** Extract a private `generateTokenPair(user)` method and call it from both `login`
and `refresh`.

---

### 2-C 🟠 HIGH — JWT Expiry Silently Falls Back to 900s

**File:** `src/auth/auth.service.ts` — `parseExpiresInToSeconds` function

**What happened:**
The `parseExpiresInToSeconds` helper has a catch-all fallback that returns `900` (15 minutes)
when it cannot parse the `JWT_ACCESS_EXPIRES_IN` value. A typo in the env var (e.g. `"15min"`
instead of `"15m"`) produces no error, no log, and silently issues tokens with the wrong
expiry. This misconfiguration is invisible until users start experiencing unexpected logouts.

**Fix:** Add a Joi regex validator in `src/config/env.schema.ts` to fail startup on
malformed values:

```typescript
JWT_ACCESS_EXPIRES_IN: Joi.string()
  .pattern(/^\d+[smhd]$/)
  .required()
  .messages({
    'string.pattern.base': 'JWT_ACCESS_EXPIRES_IN must be in format like 15m, 1h, 7d',
  }),
```

---

### 2-D 🟡 MEDIUM — Pagination Defaults Inconsistent + Offset Math Repeated

**Files:**
- `src/matches/matches.service.ts` — `limit ?? 20`
- `src/venues/venues.service.ts` — hardcoded `50` for list
- `src/users/users.service.ts` — `limit ?? 20`
- Offset calculation `(page - 1) * limit` repeated in 3+ service files

**What happened:**
There is no shared pagination utility. Each service independently defines its default page
size and recalculates the offset. The venue list silently uses `50` while everything else
defaults to `20`, with no documentation of why.

**Fix:** Add to `src/common/dto/pagination.dto.ts` (or a new `src/common/pagination.ts`):

```typescript
export const DEFAULT_PAGE_SIZE = 20;
export const toOffset = (page: number, limit: number): number => (page - 1) * limit;
```

Document per-resource overrides explicitly with a comment if they intentionally differ.

---

## Section 3: Tests

### 3-A 🔴 CRITICAL — Zero E2E Tests

**Directory:** `test/`

**What happened:**
The full E2E harness is set up and ready:
- `test/jest-e2e.json` — Jest config
- `test/setup-e2e.ts` — test setup
- `test/helpers/mock-db-pool.ts` — DB mock helper

But **no `.e2e-spec.ts` files exist anywhere in the repo.** The entire HTTP layer — routing,
guard stacking, tenant middleware behavior, request/response contracts — has zero
end-to-end test coverage.

**Fix:** Write E2E specs per module. The mock-db-pool helper means setup cost is already
paid. Minimum needed:

| Spec file | What to cover |
|-----------|---------------|
| `test/auth.e2e-spec.ts` | Register, login, refresh, bad token → 401 |
| `test/matches.e2e-spec.ts` | CRUD + guard rejection |
| `test/bookings.e2e-spec.ts` | Create, cancel, waitlist promotion |
| `test/venues.e2e-spec.ts` | Create, deactivate |
| `test/tenant.e2e-spec.ts` | Missing Host header → 400 |

---

### 3-B 🟠 HIGH — No Controller Unit Tests

**What happened:**
Every `*.spec.ts` targets services, guards, middleware, or utility functions. There are no
`*.controller.spec.ts` files for auth, matches, bookings, users, venues, or tenants
(only `app.controller.spec.ts` exists).

Controllers contain logic that is currently untested at any level:
- `@Roles` method-level overrides (wrong override = silent security hole)
- DTO mapping and transformation
- Swagger metadata used for client code generation

**Fix:** Add controller unit tests for `auth` and `bookings` as a starting point (highest
business risk). Mock the service layer. Longer-term, rely on E2E tests (3-A) for full
controller coverage.

---

### 3-C 🔴 CRITICAL — No Repository Tests

**What happened:**
Repositories contain the most complex and most critical logic in the codebase, but they
are only exercised indirectly through service specs that mock the repository layer. The
actual SQL is never run in any test.

This is what allowed Issue **1-A** (wrong status predicates) to exist silently — it was
caught by static code review, not by a failing test.

High-priority repositories to test:

| Repository | Why |
|-----------|-----|
| `bookings.repository.ts` | Wallet debit logic, waitlist promotion loop |
| `matches.repository.ts` | Computed status SQL (`COMPUTED_STATUS_SQL`) |
| `venues.repository.ts` | Atomic deactivation with `NOT EXISTS` |

**Fix:** Add integration tests using the existing `mock-db-pool` helper or a dedicated test
database. Run the real SQL and assert on results.

---

### 3-D 🟡 MEDIUM — Service Specs Skip Error Propagation Paths

**What happened:**
Service specs cover happy paths well but do not test what happens when things go wrong.
The following failure modes are currently untested:

- `patchMatchForTenant` should throw `ConflictException` when PG unique violation fires
- `promoteWaitlist` silently returning `{ promotedEmail: null }` when match is in wrong state
- Wallet insufficient-funds path in bookings service

**Fix:** Add one test case per `catch(err)` block in each service. Example pattern:

```typescript
it('throws ConflictException on unique violation', async () => {
  matchesRepository.patchMatchForTenant.mockRejectedValue({ code: '23505' });
  await expect(service.updateForTenant(...)).rejects.toThrow(ConflictException);
});
```

---

## Section 4: Performance

### 4-A 🟠 HIGH — Waitlist Promotion: O(n) Queries Per Player

**File:** `src/bookings/bookings.repository.ts` lines 725–885

**What happened:**
`promoteWaitlistInTransaction` iterates over each pending booking and for every single player
fires up to **6 separate DB queries**:

1. `SELECT COUNT` of confirmed bookings
2. `SELECT COUNT` of confirmed GKs (if position-capped)
3. Wallet balance check
4. Wallet debit `UPDATE`
5. Wallet transaction `INSERT`
6. Booking status `UPDATE`

For a match with 20 waitlisted players this is potentially **120 queries in a single
transaction**, keeping the DB connection locked for the entire duration.

Queries 1 and 2 are the easiest to fix — they reference the same match and return the same
value on every iteration of the loop.

**Fix:** Run the confirmed-count queries **once before the loop**:

```typescript
// Run once before iterating:
const confirmedCount = await getConfirmedCount(client, matchId);
const confirmedGkCount = await getConfirmedGkCount(client, matchId);

// Loop only handles per-player wallet + booking updates
for (const booking of pendingList) {
  // use confirmedCount / confirmedGkCount directly
}
```

This alone reduces worst-case query count by ~30–40%. A full rewrite as a PL/pgSQL stored
procedure is the correct answer at scale but high effort.

---

### 4-B 🟡 MEDIUM — Wallet Uses `parseFloat()` on NUMERIC

**Files:** `src/bookings/bookings.repository.ts` lines ~256, ~610, ~836

**What happened:**
`pg` returns `NUMERIC` columns as strings specifically to preserve decimal precision.
Casting them with `parseFloat()` throws that precision away and introduces IEEE 754
floating-point representation errors (`0.1 + 0.2 !== 0.3`).

**Fix:**
- If prices are always whole currency units: use `parseInt()` and document the constraint.
- If fractional prices are possible: use `decimal.js` for all wallet arithmetic.

---

### 4-C 🟢 LOW — Tenant Middleware Cache Has No Size Limit

**File:** `src/tenant/tenant.middleware.ts` lines ~34–51

**What happened:**
The module-level `Map` used to cache tenant lookups has no LRU eviction or max-size cap.
In a long-running process with many unique slugs, this map grows without bound.

**Fix:** Defer to production. The slug space is bounded in practice for a sports booking
platform. Flag for revisit before first production deployment.

---

## Implementation Priority

```
Phase 1 — Fix Bugs (do now)
  [ ] 1-A: Fix SQL status predicates in venues.repository + bookings.repository
  [ ] 2-C: Add Joi validator for JWT_ACCESS_EXPIRES_IN in env.schema.ts

Phase 2 — Code Quality (next sprint)
  [ ] 1-C: Create src/common/constants/pg-errors.ts + isUniqueViolation() guard
  [ ] 2-A: Simplify deactivateForTenant — remove duplicate retry block
  [ ] 2-B: Extract generateTokenPair() in auth.service.ts
  [ ] 2-D: Add shared toOffset() + DEFAULT_PAGE_SIZE to common/pagination.ts
  [ ] 1-D: Verify + unify transaction entry points

Phase 3 — Tests (ongoing)
  [ ] 3-A: E2E specs per module (auth, matches, bookings, venues, tenant)
  [ ] 3-C: Repository integration tests (bookings, matches, venues)
  [ ] 3-B: Controller unit tests (auth, bookings)
  [ ] 3-D: Error path test cases in service specs

Phase 4 — Performance (before load testing)
  [ ] 4-A: Extract count queries before waitlist promotion loop
  [ ] 4-B: Switch wallet to decimal.js or integer cents
  [ ] 4-C: (Defer) Tenant cache eviction
```

---

*Generated by code review session — 2026-04-11*
