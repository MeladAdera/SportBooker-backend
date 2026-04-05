# Sportbooker — UI/UX Design Brief

> **Purpose:** This document is the authoritative brief for the UI/UX design of the Sportbooker platform. It defines scope, requirements, flows, and standards. The designer should read this in full before starting any work.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Target Audience](#2-target-audience)
3. [Platform & Technical Constraints](#3-platform--technical-constraints)
4. [Brand & Visual Direction](#4-brand--visual-direction)
5. [Deliverables](#5-deliverables)
6. [Information Architecture](#6-information-architecture)
7. [Screen Inventory & Requirements](#7-screen-inventory--requirements)
   - [Auth Flows](#71-auth-flows)
   - [Player Flows](#72-player-flows)
   - [Operator Flows (Super Admin, Tenant Admin & Staff)](#73-operator-flows-super-admin-tenant-admin--staff)
   - [Platform Admin](#74-platform-admin)
   - [Shared Screens](#75-shared-screens)
8. [Component & State Requirements](#8-component--state-requirements)
9. [Design System Requirements](#9-design-system-requirements)
10. [UX Principles & Standards](#10-ux-principles--standards)
11. [Open Design Decisions](#11-open-design-decisions)
12. [Glossary](#12-glossary)

---

## 1. Product Overview

**Sportbooker** is a multi-tenant, white-label sports booking SaaS platform.

Each **tenant** is a sports club or organiser (e.g. ACFC, Downtown Sports). They get their own branded subdomain (`acfc.sportbooker.com`). Inside their space they manage **venues** (pitches, courts), schedule **matches**, and allow **players** to book spots. Players pay from an internal **wallet**. When a match is full, players join a **waitlist** and are still charged — they are refunded if they never get a confirmed spot or cancel before the match.

**In short:** Think of it as a private Eventbrite for sports clubs, with wallet payments, waitlists, and goalkeeper position tracking.

### Role summary (for the designer)

| Role | Who they are | Where they log in |
|------|-------------|-------------------|
| **Platform Admin** | The SaaS operator — manages all clubs on the platform | `platform.sportbooker.com` (their own subdomain) |
| **Super Admin** | The club owner — full authority within one tenant, manages tenant settings | `<club-slug>.sportbooker.com` |
| **Tenant Admin** | The club manager — runs venues, matches, players day-to-day | `<club-slug>.sportbooker.com` |
| **Tenant Staff** | Operational employee — creates/edits but no destructive actions | `<club-slug>.sportbooker.com` |
| **Player** | End customer — books and pays for match spots | `<club-slug>.sportbooker.com` |

### Key business facts the design must reflect

- Players and operators (super admin / admin / staff) share the **same app** — the UI adapts based on role after login.
- There is **no external payment** at booking time — the wallet must be funded first (top-up flow to be designed, backend coming later).
- **Confirmed players who cancel do NOT get a refund.** This must be clearly communicated before they cancel.
- A player can be on the waitlist **and be charged immediately** — this is unusual UX that needs explicit, plain-language explanation.
- **Maximum 2 goalkeepers** per match — this is a hard business rule that affects the booking UI.
- Each tenant has a **cancellation cutoff window** (default 24 hours) — players cannot cancel a confirmed booking within that window.
- The **Platform Admin** has a completely separate navigation and does not see club-level data (venues, matches, players). Their UI is purely administrative — tenant management only.
- The **Super Admin** has the same operational UI as Tenant Admin but with an additional **Tenant Settings** section that no other tenant role can access.

---

## 2. Target Audience

### 2.1 Players (end customers)

| Attribute | Detail |
|-----------|--------|
| Geography | UAE / Gulf region primarily |
| Profile | Casual weekend players **and** competitive/organised league players |
| Device usage | Mobile-first — most interactions happen on phone (browsing, booking, checking wallet) |
| Tech literacy | Mixed — design must be approachable for non-technical users |
| Key motivations | Find a game fast, know if it's full, understand what they paid for |
| Key frustrations | Confusing waitlist mechanics, surprise charges, not knowing how to add wallet credit |

### 2.2 Tenant Operators (Super Admin, Tenant Admin, Tenant Staff)

| Attribute | Detail |
|-----------|--------|
| Roles | Super Admin (full control + tenant settings), Tenant Admin (full operational control), Tenant Staff (day-to-day, no destructive actions) |
| Club size | All sizes: single-venue independent clubs to multi-venue sports centres |
| Device usage | Mix of desktop (management tasks) and mobile (quick lookups on-site) |
| Key motivations | Fill matches, manage cancellations, see who's confirmed, run operations smoothly |
| Key frustrations | Complex management UIs, hidden data, difficulty cancelling matches and notifying players |

### 2.3 Platform Admin

| Attribute | Detail |
|-----------|--------|
| Role | Platform Admin — the SaaS operator who owns the whole platform |
| Device usage | Desktop only (management tasks) |
| Key motivations | Onboard new clubs atomically (tenant + super admin in one step), activate/deactivate clubs, platform oversight |
| Key frustrations | Multi-step onboarding, no clear tenant status visibility |

---

## 3. Platform & Technical Constraints

### 3.1 Platform

- **Web application** (not a native app at this stage)
- **Mobile-first** — design for a 375px minimum viewport as the primary canvas
- Must be fully responsive and functional on desktop (1280px+) and tablet (768px+)
- No native app at this stage; future native app should be considered when making component decisions (keep components portable)

### 3.2 Architecture notes for the designer

- The app is **multi-tenant** — each club has its own subdomain. The designer should account for a **tenant branding zone** (logo, name) that clubs can customise. Do not hard-code a single brand identity into tenant screens.
- The **Platform Admin** logs into `platform.sportbooker.com` — their UI has no tenant branding zone; it is a pure admin panel.
- The **same login page** serves all roles on a given subdomain. After login, the app knows the user's role and renders accordingly.
- **Real-time updates are not currently implemented.** Do not design experiences that imply live data push.
- **File uploads** exist for venue photos and user profile photos — design appropriate upload components.
- **Static file serving** is handled at `/uploads/...` — image URLs will be absolute paths.

### 3.3 Language & Localisation

- **English only** for the initial release
- **Arabic / RTL must be designed from day one** — given the UAE market, RTL support is not optional. Every layout decision (grid, flexbox direction, icon placement, text alignment) must be RTL-compatible.
  - Use logical CSS properties in all handoff annotations (`margin-inline-start` not `margin-left`)
  - All icons that imply direction (arrows, chevrons, sliders) must have RTL mirror variants
  - Test every screen layout in both LTR and RTL during design review

---

## 4. Brand & Visual Direction

### 4.1 Tone

**Energetic & bold.** The design should feel like a sports product — confident, high-contrast, action-oriented. Think Nike digital products or ESPN App, not a healthcare portal. Energy should be felt in the motion, typography weight, and imagery choices. But it must remain **clean and scannable** — players are booking on the go; clutter is the enemy.

The **Platform Admin** UI should feel more like a B2B tool — clean, data-dense, professional — while still sharing the same design system and tokens.

### 4.2 Logo

No existing logo. **Logo creation is out of scope for this engagement.** Use a placeholder wordmark ("Sportbooker" or the tenant's name) in all screens. The designer must design a **tenant branding slot** (logo area + name) that can be swapped per tenant. The Platform Admin UI uses a fixed platform wordmark — no tenant branding slot.

### 4.3 Colour

Full creative freedom. Recommendations based on the brand tone and market:

- A **strong primary colour** with high contrast (deep green, electric blue, or vibrant orange work well for sports — avoid pastels)
- A **dark neutral** for backgrounds and surfaces (dark navy or near-black is preferred over pure `#000000`)
- A **semantic colour set**: success (green), error (red), warning (amber), info (blue) — these are non-negotiable for wallet, booking status, and error states
- Both **light and dark mode** are required — the colour system must be tokenised and support both themes from the start

### 4.4 Typography

- Use a **modern geometric sans-serif** (Inter, Geist, or similar) — avoid decorative fonts
- Type scale must have at least: Display, H1, H2, H3, Body Large, Body, Caption, Label
- All type sizes must pass **4.5:1 contrast ratio** on their intended backgrounds (light and dark)
- Numbers (wallet balance, match times, player counts) must use **tabular figures** to prevent layout shift

### 4.5 Iconography

- Use a **consistent icon library** (Lucide, Phosphor, or custom) — do not mix styles
- Sport icons are needed: football, basketball, tennis, volleyball, padel, cricket, generic — the designer must provide these
- Position icons: field player vs goalkeeper distinction must be visually clear
- All icons must be delivered as **SVG**

### 4.6 Motion & Interaction

- Motion should feel **fast and purposeful** — not decorative
- Micro-interactions on: booking confirmation, wallet deduction, waitlist join, match cancellation confirmation
- Transitions between role views (if the app is unified) should be smooth but instant — not animated slideshows
- Respect `prefers-reduced-motion` in all animation decisions

### 4.7 Imagery

- Match/venue cards should support **photography** (uploaded venue images)
- Design cards to look good with AND without an image (graceful fallback)
- Avoid stock illustrations of people playing sports — they feel generic; use iconography and data instead

---

## 5. Deliverables

The designer must deliver a **single organised Figma file** with the following pages:

| Figma Page | Contents |
|------------|----------|
| `Cover` | Project title, version, date, designer name |
| `Design System` | Tokens, colour styles, typography, spacing, grid, shadows, all components |
| `Wireframes` | Low-fidelity layouts for all flows (grayscale, no final styling) |
| `Mockups` | High-fidelity screens — all flows, all states (loading, empty, error, success) |
| `Prototype` | Clickable prototype wired from the Mockups page |
| `Assets` | All exported icons (SVG), illustrations, and image placeholders organised by category |

Additionally:

- **Design Decisions Document** (can be a Notion page, PDF, or separate Figma page): a brief explanation of key design decisions — why a specific colour system was chosen, why a flow was structured a particular way, any trade-offs made.
- **Exported assets**: all icons and images exported in SVG (icons) and SVG + PNG 2x (images/illustrations).

### Screen coverage standard

**Full coverage is required** — every screen must include:
- Default / loaded state
- Loading / skeleton state
- Empty state (no data)
- Error state (API error, validation error)
- Success / confirmation state
- Where applicable: disabled state, hover state, focus state (for desktop)

---

## 6. Information Architecture

The app is a **single unified web application** that renders different navigation and features based on the logged-in user's role.

### 6.1 Navigation model

**Mobile (primary):** Bottom navigation bar (max 5 items) for players. For operators, a collapsible side drawer or bottom nav — designer's call, must justify.

**Desktop:** Left sidebar navigation.

### 6.2 Player navigation

```
Bottom Nav:
├── Home / Discover       (match discovery feed)
├── My Bookings           (confirmed + waitlist)
├── Wallet                (balance + transactions)
└── Profile               (settings, account)
```

### 6.3 Operator navigation (Super Admin, Tenant Admin & Staff)

```
Sidebar / Drawer:
├── Dashboard             (summary stats: bookings today, revenue, occupancy)
├── Matches               (list + create)
├── Venues                (list + create)
├── Players               (user list + detail)
├── Tenant Settings       (super_admin only — name, logo, timezone, cutoff hours)
└── Account               (own profile)
```

**Visibility rules:**
- **Tenant Settings** section is only rendered for `super_admin`. It is not shown (not disabled) for `tenant_admin` or `tenant_staff`.
- **Deactivate Venue** and **Cancel Match** actions are only rendered for `super_admin` and `tenant_admin`. Staff do not see these controls at all.
- **Role assignment** controls in Player Detail are only rendered for `super_admin` and `tenant_admin`.

### 6.4 Platform Admin navigation

```
Sidebar:
├── Tenants               (list + create + activate/deactivate)
└── Account               (own profile)
```

The Platform Admin UI does not include Venues, Matches, Players, or Wallet screens. Their scope is entirely tenant lifecycle management.

### 6.5 Shared

```
Always accessible:
├── Notifications bell    (future scope — include as placeholder)
├── User avatar menu      (profile, settings, logout)
└── Tenant branding zone  (logo + club name — top of sidebar / app bar)
    └── Not shown on Platform Admin's panel (uses platform wordmark instead)
```

---

## 7. Screen Inventory & Requirements

> Each screen must be designed in **light and dark mode**, **mobile and desktop** breakpoints, and all states listed in §5.

---

### 7.1 Auth Flows

#### `AUTH-01` — Login

- Email + password fields
- "Forgot password?" link
- Submit button
- Link to register (not shown on Platform Admin login)
- **States:** default, loading, error (invalid credentials), error (account inactive/deleted)
- **Notes:** The tenant's branding (club logo, name) should be visible on tenant login screens — players and operators log into their club's subdomain, so it feels like the club's own app. The Platform Admin login at `platform.sportbooker.com` shows the platform wordmark instead — no club branding.

#### `AUTH-02` — Register

- Name, email, password, phone (optional)
- Terms acceptance checkbox
- Submit button
- **States:** default, loading, field validation errors, success (redirect to onboarding or home)
- **Notes:** Registration is only available on tenant subdomains — not on the platform admin subdomain.

#### `AUTH-03` — Forgot Password

- Email field
- Submit button
- **States:** default, loading, success (always — anti-enumeration, always shows "if that email exists, a link was sent")

#### `AUTH-04` — Reset Password

- New password + confirm password fields
- Submit button
- **States:** default, loading, success, error (token expired/used)

---

### 7.2 Player Flows

#### `PLAYER-01` — Home / Discover

The core player screen. Players browse available upcoming matches.

- **Filter bar:** sport type, venue, date picker, availability toggle ("show only available")
- **View toggle:** Card grid view ↔ List view (designer's call on default)
- **Match card** contains: sport icon, match title, venue name, date & time, price per player, spots remaining (`X / Y`), status badge
- **Empty state:** "No matches found" with suggestion to clear filters
- **States:** loading (skeleton cards), empty, loaded, error

#### `PLAYER-02` — Match Detail

- Hero: venue photo, sport type badge
- Match info: title, venue, date/time, duration, price, sport type
- **Capacity bar:** visual representation of confirmed / max players (e.g. `8 / 12 confirmed`)
- **Goalkeeper slots:** separate indicator — e.g. `1 / 2 GK spots taken`
- **Roster:** list of confirmed players (name + position) — ordered alphabetically
- **Booking CTA:**
  - If available → "Book Now" (show price)
  - If waitlist only → "Join Waitlist" (show price + prepaid notice)
  - If already booked (confirmed) → "You're in" + "Cancel Booking" button
  - If already waitlisted → "You're on the waitlist" + "Leave Waitlist" button
  - If match cancelled → "This match has been cancelled" banner
  - If match in the past → booking CTA hidden
- **Notes:** The waitlist prepaid notice is critical — it must be prominent and plain-language: *"Your wallet will be charged immediately. If you don't get a confirmed spot, or you cancel before the match, the full amount will be refunded."*

#### `PLAYER-03` — Booking Confirmation Modal / Screen

Shown after a successful booking (confirmed or waitlisted).

- **Confirmed path:** Celebration moment — match summary, amount deducted, new wallet balance, "View My Bookings" CTA
- **Waitlist path:** Different tone — "You're on the waitlist" summary, amount charged (with refund promise), position context if possible, "View My Bookings" CTA
- **Position selector:** Before confirming, player selects `Field Player` or `Goalkeeper` — show GK availability inline

#### `PLAYER-04` — Cancel Booking Confirmation

A deliberate, friction-adding confirmation step. This is **irreversible and has financial consequences**.

- **Confirmed booking cancel:**
  - Warning banner: *"You will NOT receive a refund for this cancellation."*
  - Show the amount that will be forfeited
  - Confirm button (destructive colour) + Cancel button
  - If within the cutoff window: show error — *"Cancellations are not allowed within [X] hours of match start."*
- **Waitlist cancel:**
  - Neutral tone: *"Your [amount] will be refunded to your wallet."*
  - Confirm + Cancel

#### `PLAYER-05` — My Bookings

- **Tabs:** Upcoming | Past | Waitlist (or combined with status badges)
- **Booking card:** match title, venue, date/time, position, status badge (`Confirmed`, `Waitlist`, `Cancelled`), paid amount
- Tapping opens Match Detail with booking context
- **Empty states** per tab

#### `PLAYER-06` — Wallet

- **Balance display:** Large, prominent — this is the key piece of information
- **Top-up CTA:** Design the full top-up flow (see `PLAYER-07`) — backend is coming
- **Transaction list:** chronological, each entry shows type badge (`Deduction`, `Refund`, `Top-up`), amount (deductions in red, credits in green), description (match name), date
- **Filters:** by type, by date range
- **Empty state:** No transactions yet

#### `PLAYER-07` — Wallet Top-Up Flow

Full design required even though backend doesn't exist yet. The screens will be used when Stripe (or equivalent) is integrated.

- **Step 1 — Amount selection:** Preset amounts (e.g. 50, 100, 200 AED) + custom amount input
- **Step 2 — Payment method:** Card entry (card number, expiry, CVV) — standard Stripe-like card form
- **Step 3 — Confirmation:** Summary (amount, new balance after top-up), confirm button
- **Step 4 — Success / Failure:** Success shows new balance; failure shows retry option
- **Placeholder notice** on the entry point: *"Online top-up is coming soon. Contact your club to add credit."* — This is the fallback for pre-launch.

#### `PLAYER-08` — Profile & Settings

- Profile photo (upload)
- Name, email, phone — editable
- Password change
- **Delete account** option — destructive, with explicit warning:
  *"You can only delete your account if you have no upcoming confirmed bookings."*
- Logout button

---

### 7.3 Operator Flows (Super Admin, Tenant Admin & Staff)

> All screens in this section are shared by Super Admin, Tenant Admin, and Tenant Staff unless explicitly noted. Role-specific differences are called out inline.

#### `OPS-01` — Dashboard

- **Stats cards:** Today's bookings, Total confirmed players this week, Match occupancy rate, Revenue this month
- **Upcoming matches summary:** next 5 matches with quick booking counts
- **Recent activity feed** (optional — designer's call)
- Notes: Staff see the same dashboard minus revenue stats (revenue is admin-only)

#### `OPS-02` — Match List

- Table (desktop) / card list (mobile)
- Columns/fields: title, venue, sport, date/time, status badge, confirmed/max players, actions
- **Status badge set:** `Upcoming`, `In Progress`, `Completed`, `Cancelled`
- **Filters:** by status, venue, sport type, date range
- **Create match CTA** (top right)
- **Quick actions per row:** View | Edit | Cancel (super_admin + tenant_admin only — do not show for staff, not even disabled)

#### `OPS-03` — Match Detail (Operator view)

- All match info (same as player view but editable)
- **Full roster:** confirmed players + waitlist players (separate sections)
  - Confirmed section: player name, position, paid amount, booking time
  - Waitlist section: player name, position, join time, prepaid amount
- **Edit match** button
- **Cancel match** button (super_admin + tenant_admin only — not shown for staff)

#### `OPS-04` — Cancel Match Confirmation

High-stakes screen — affects real money.

- Warning summary: number of confirmed players to be refunded, total refund amount
- List of affected players (names + amounts)
- Email notice: *"Cancellation notification emails will be sent to all confirmed players."*
- Confirm (destructive) + Back button
- **States:** loading (while processing), success (match cancelled + confirmation), error

#### `OPS-05` — Create / Edit Match

- Venue selector (dropdown, tenant venues only)
- Title, sport type selector, date + time picker, duration (minutes), price per player, max players
- **Validation feedback** (inline): overlap warning, past date error, max players below confirmed count (edit only)
- Preview of match card as player will see it
- Save / Publish button

#### `OPS-06` — Venue List

- Card grid (desktop) / list (mobile)
- Venue card: photo, name, sport types (tag chips), status badge (`Active` / `Inactive`), match count
- Filters: by status, sport type
- **Create venue CTA**

#### `OPS-07` — Venue Detail

- Photo, name, address, maps link, sport type tags
- **Active matches count** (upcoming/in-progress)
- Edit button
- **Deactivate / Activate toggle** — deactivate is super_admin and tenant_admin only; not shown for staff; blocked with error if active matches exist

#### `OPS-08` — Create / Edit Venue

- Name, address, maps URL
- **Sport type multi-selector** (multi-chip select: football, padel, cricket, generic — these 4 only)
- **Photo upload** (drag-and-drop + file picker) OR photo URL input — one is required
- Validation states

#### `OPS-09` — Player List (User Management)

- Table (desktop) / list (mobile)
- Columns: name, email, phone, role badge, status (`Active` / `Inactive` / `Deleted`), wallet balance, join date
- **Search** by name/email
- **Filter** by role, status
- Row → opens Player Detail
- **Note:** Staff cannot see deleted players (`includeDeleted` is super_admin and tenant_admin only)

#### `OPS-10` — Player Detail

- Profile info: name, email, phone, photo, role badge, status, join date
- **Wallet balance** (visible to all operators)
- **Booking history** (upcoming + past)
- **Change role** button (super_admin + tenant_admin only — not shown for staff) → dropdown: `Tenant Admin`, `Tenant Staff`, `Player`
- **Role assignment rules** must be reflected:
  - Neither admin nor super_admin can change a Platform Admin's role
  - Tenant Admin cannot change a Super Admin's role
  - A user cannot change their own role to a lower one
  - Neither `super_admin` nor `platform_admin` can be assigned via this dropdown

#### `OPS-11` — Tenant Settings (Super Admin only)

This section is **only rendered for `super_admin`**. It is not visible to `tenant_admin` or `tenant_staff` at all.

- Tenant name (editable)
- Slug (read-only after creation)
- Timezone selector (IANA)
- Logo URL (optional)
- **Cancellation cutoff hours** (number input with explanation tooltip: *"Players cannot cancel confirmed bookings within this many hours of match start."*)
- Save button
- **Note:** `is_active` (activate/deactivate tenant) is NOT shown here. Only the Platform Admin controls tenant activation.

---

### 7.4 Platform Admin

The Platform Admin UI is a standalone admin panel — it does not share navigation with the tenant-scoped operator UI. No venues, matches, or player screens. No tenant branding zone.

#### `PA-01` — Tenant List

- Table: tenant name, slug, status badge (`Active` / `Inactive`), timezone, created date, super admin email, actions
- **Filters:** by status
- **Search** by name or slug
- **Create tenant CTA** (opens `PA-03`)
- **Quick actions per row:** View | Edit | Activate / Deactivate (toggle depending on current status)

#### `PA-02` — Tenant Detail

- All tenant info: name, slug, timezone, logo, cancel cutoff hours
- Status badge + Activate/Deactivate action button
- Super admin info card: name, email (the initial super admin created with this tenant)
- Edit button → `PA-03`
- Audit info: created at, updated at

#### `PA-03` — Create Tenant

This is an **atomic form** — it creates both the tenant and the initial super admin in a single submission.

**Section 1 — Tenant details:**
- Name
- Slug (with slug availability inline validation — check on blur)
- Timezone selector (IANA timezone picker)
- Cancel cutoff hours (number input, default 24)
- Logo URL (optional)

**Section 2 — Initial Super Admin:**
- Name
- Email
- Password (with strength indicator)

- Save / Create button
- **States:** default, validating slug, loading (submitting), success (redirect to Tenant Detail), error (slug taken, email conflict, validation failure)
- **Note:** Slug and super admin email are unique — the form must surface conflicts clearly.

#### `PA-04` — Edit Tenant

- Same fields as Create but slug is **read-only**
- Super admin section is **not shown** (super admin is created once at tenant creation; subsequent management is out of scope for now)
- `is_active` is managed via the Activate/Deactivate button in the list/detail — not a field in this form

#### `PA-05` — Platform Admin Profile

- Name, email — editable
- Password change
- Logout button

---

### 7.5 Shared Screens

#### `SHARED-01` — Notification Centre (Placeholder)

- Bell icon in app bar with unread badge
- Panel/drawer that opens: "Notifications are coming soon" empty state with icon
- **Design the full notification list UI** even if data is empty — this is infrastructure the backend will fill in later. Include: unread indicator, notification type icon, title, body, timestamp, mark as read.

#### `SHARED-02` — 404 / Not Found

- Friendly error page — sport-themed if possible
- CTA to go back to home

#### `SHARED-03` — 403 / Access Denied

- Clear explanation: "You don't have permission to view this page"
- CTA appropriate to role

#### `SHARED-04` — Inactive Tenant

- Shown when a player visits a deactivated club's subdomain
- Should feel like the club's branded page (tenant branding still visible)
- Message: "This club is currently not available."

#### `SHARED-05` — Global Error / Maintenance

- Generic API error fallback
- Retry CTA

---

## 8. Component & State Requirements

Every interactive component must have designs for all relevant states. The following table is a minimum requirement:

| Component | Required States |
|-----------|----------------|
| Button (Primary) | Default, Hover, Active/Pressed, Loading (spinner), Disabled |
| Button (Destructive) | Default, Hover, Active, Loading, Disabled |
| Button (Ghost/Secondary) | Default, Hover, Active, Disabled |
| Text Input | Default, Focus, Filled, Error, Disabled, Read-only |
| Dropdown / Select | Default, Open, Selected, Error, Disabled |
| Multi-select (sport types) | Default, Option hover, Option selected, Max selected |
| Date/Time Picker | Default, Open, Date selected, Range, Error |
| File Upload | Default, Drag over, File selected (preview), Uploading, Success, Error |
| Match Card | Default, Hover, Full (no spots), Waitlist only, Cancelled, Past |
| Booking Card (player) | Confirmed, Waitlist, Cancelled |
| Status Badge | All status values per entity (see §9 enums) |
| Wallet Balance | Positive balance, Zero balance |
| Capacity Bar | Various fill levels (0%, 50%, 100%, GK full) |
| Toast / Notification | Success, Error, Warning, Info |
| Modal / Confirmation | Default, Loading, Success, Error |
| Bottom Nav (mobile) | Default, Active tab, Badge (unread count) |
| Skeleton / Loading | Cards, Table rows, Profile, Wallet |
| Empty State | Various — per screen context (no matches, no bookings, etc.) |
| Role Badge | platform_admin, super_admin, tenant_admin, tenant_staff, player — each distinct |
| Slug input | Default, Checking (loading), Available (success), Taken (error) |

---

## 9. Design System Requirements

The designer must deliver a complete, tokenised design system in Figma. It must include:

### 9.1 Token Structure

```
tokens/
├── color/
│   ├── primitive/      (raw palette: green-500, slate-900, etc.)
│   ├── semantic/       (background, surface, text-primary, border, etc.)
│   └── status/         (success, error, warning, info — bg + text + border)
├── typography/
│   ├── font-family
│   ├── font-size       (scale: xs → 4xl)
│   ├── font-weight
│   ├── line-height
│   └── letter-spacing
├── spacing/            (4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
├── radius/             (none, sm, md, lg, full)
├── shadow/             (sm, md, lg, xl)
└── motion/             (duration: fast/normal/slow, easing curves)
```

All tokens must be defined for **both light and dark mode**.

### 9.2 Component Library

Components must be built as **Figma components with variants** covering all states from §8. Components must use **auto layout** throughout — no fixed-size frames.

### 9.3 Grid System

- **Mobile:** 4-column grid, 16px gutter, 16px margin
- **Tablet:** 8-column grid, 24px gutter, 24px margin
- **Desktop:** 12-column grid, 24px gutter, 80px margin

### 9.4 Enums — Status Badges

The following statuses need distinct badge designs (background + text colour):

**Match status:** `Upcoming` (primary), `In Progress` (warning), `Completed` (neutral), `Cancelled` (error)

**Booking status:** `Confirmed` (success), `Waitlist` (warning), `Cancelled` (neutral/muted)

**Venue status:** `Active` (success), `Inactive` (error)

**User status:** `Active` (success), `Inactive` (warning), `Deleted` (neutral/muted)

**Wallet transaction type:** `Deduction` (red/error), `Refund` (green/success), `Top-up` (primary), `Credit` (primary)

**User role:** `Platform Admin`, `Super Admin`, `Tenant Admin`, `Staff`, `Player` — each needs a distinct badge. `Platform Admin` and `Super Admin` should feel elevated / distinct from the tenant roles.

**Tenant status:** `Active` (success), `Inactive` (error)

---

## 10. UX Principles & Standards

### 10.1 Money is serious — design accordingly

Any screen that involves a wallet deduction, refund, or forfeiture must:
- Show the **exact amount** before confirmation
- Use **explicit, plain-language copy** (no euphemisms)
- Require a **deliberate confirmation step** (no accidental charges)
- Confirm the **new wallet balance** after any transaction

### 10.2 Waitlist UX must be crystal clear

This is the most confusing mechanic for players. The design must:
- Never use the word "pending" alone — always explain *why* (you're on the waitlist)
- Always show the prepaid charge amount and refund promise at point of joining
- Provide a clear differentiation between **waitlisted** and **confirmed** bookings everywhere they appear
- Show waitlist bookings in a visually distinct (but not alarming) way

### 10.3 Destructive actions need friction

Cancel match, cancel booking (no refund), delete account, deactivate tenant — all require:
- A dedicated confirmation screen/modal (not just an `alert()`)
- Explicit summary of consequences
- Destructive button labelled with the action ("Cancel This Match", not "Confirm")
- Escape path always visible ("Go Back")

### 10.4 Role-based UI — be surgical

Do not show controls that a user's role cannot use. Examples:
- Staff: no "Deactivate Venue" button — don't show it disabled, don't show it at all
- Staff: no "Cancel Match" button
- Tenant Admin: no "Tenant Settings" navigation item
- Platform Admin: no Venues, Matches, or Players sections
- Player: no venue management navigation
- Player: "Delete Account" is blocked if they have upcoming confirmed bookings — show the reason, not just a disabled button

### 10.5 Operator screens prioritise data density

Admins and staff are power users doing repetitive operational tasks. On desktop:
- Use **tables**, not cards
- Support **inline actions** (don't navigate away for simple status changes)
- Filters and search are **persistent** (don't reset on navigation)
- Show **counts and summaries** wherever possible

### 10.6 Player screens prioritise clarity and speed

Players are on mobile, often on the go, making quick decisions:
- Match browsing must be **scannable** — the most important info (sport, time, price, spots left) visible without tapping
- Booking must be achievable in **3 taps or fewer** from the discover screen
- Wallet balance must be **always visible** (persistent in nav or app bar)

### 10.7 Platform Admin UI is data-first

The platform admin cares about tenant status, not individual player bookings. Their UI should:
- Show **clear at-a-glance tenant health** (active vs inactive, created date)
- Make the **create tenant flow obvious** — this is the primary action
- Make activate/deactivate status changes **instant and confirmable** (a modal before deactivating a tenant — this has real impact)
- Never mix tenant-level management with club operational data

### 10.8 Empty states are first impressions

New tenants and new players will see empty states first. Design them as **onboarding moments**, not dead ends:
- Empty match list for a player → "No matches yet. Check back soon."
- Empty venue list for an admin → "Create your first venue to get started." with a CTA
- Empty tenant list for platform admin → "No tenants yet. Create your first club." with a CTA

### 10.9 Accessibility (best effort)

While strict WCAG compliance is not required, the following are non-negotiable:
- All text must meet **4.5:1 contrast ratio** (normal text) / **3:1** (large text / UI elements)
- All interactive elements must have a **visible focus indicator**
- Touch targets on mobile must be **minimum 44×44px**
- Do not use **colour alone** to convey information (e.g. status badges must use icon + label, not just colour)
- All form fields must have **visible labels** (no placeholder-only labels)

---

## 11. Open Design Decisions

The following decisions were not specified and are left to the designer's professional judgement. For each, the designer must document the reasoning in the Design Decisions document.

| # | Decision | Context |
|---|----------|---------|
| 1 | **Match browsing layout** | Card grid (marketplace feel) vs calendar/schedule view vs hybrid with toggle. Recommend considering hybrid — calendar for competitive players, card grid for casual discovery. |
| 2 | **Waitlist position visibility** | Should players see their position in the waitlist queue (e.g. "3rd in line")? The backend stores `created_at` order but doesn't expose a queue position in the current API. Designer should propose the UX and flag if backend work is needed. |
| 3 | **Operator mobile navigation** | Bottom nav (same as player) or hamburger drawer? Admins doing management tasks on mobile is secondary, but it must work. |
| 4 | **Onboarding depth** | Post-registration: redirect straight to discover, or show a short guided tour (wallet setup prompt, how to book)? Recommend a non-intrusive first-time tooltip layer rather than a full onboarding flow. |
| 5 | **Notification centre** | Bell icon with placeholder panel (backend coming). Design the full UI now. Should the notification list be a side drawer or a full page? |
| 6 | **Top-up entry point** | Wallet top-up CTA placement — in the wallet page only, or also surfaced when balance is too low to book (contextual prompt at booking step)? Recommend both. |
| 7 | **Admin revenue visibility** | Revenue stats on the dashboard (total revenue, revenue per match) — the backend doesn't currently have a dedicated analytics endpoint. Designer should design the UI and flag which data points require new API endpoints. |
| 8 | **Super Admin vs Tenant Admin visual differentiation** | Both use the same operator UI. Should the Super Admin experience feel subtly elevated (e.g. a different accent in the nav, a badge next to their name)? Recommend a subtle "Owner" badge. |
| 9 | **Platform Admin subdomain branding** | The platform admin logs in at `platform.sportbooker.com`. What does that login page look like? No club branding — just the Sportbooker platform wordmark. Designer should propose a distinct but cohesive look. |

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **Tenant** | A sports club or organiser using the platform. Has its own subdomain. |
| **Venue** | A physical sports facility belonging to a tenant (pitch, court, etc.). |
| **Match** | A scheduled sports game at a venue with a fixed price and player limit. |
| **Booking** | A player's reservation for a match. Either Confirmed or Waitlisted. |
| **Waitlist** | When a match is full, new bookings become pending/waitlisted. Player is charged immediately. |
| **FIFO Promotion** | When a confirmed spot opens, the oldest waitlisted player is automatically promoted. |
| **Wallet** | Each player's internal credit balance. All bookings are paid from this. |
| **Wallet Transaction** | A record of every balance change (debit, refund, top-up, credit). |
| **Cancel Cutoff** | Per-tenant setting (default 24h). Players cannot cancel confirmed bookings inside this window. |
| **Position** | Each booking is either `Field Player` or `Goalkeeper`. Max 2 confirmed GKs per match. |
| **Soft Delete** | User accounts are not permanently deleted — they are deactivated with a timestamp. Data is preserved. |
| **Platform Admin** | The SaaS operator. Creates tenants (atomically with super admin). Controls tenant activation. Lives in the `platform` system tenant. |
| **Super Admin** | Tenant-scoped top authority. Created atomically with the tenant by platform admin. Can update tenant settings, manage all tenant operations including destructive actions. Cannot activate/deactivate the tenant. |
| **Tenant Admin** | Operator role with full management access including destructive actions (deactivate venue, cancel match). Cannot update tenant settings. |
| **Tenant Staff** | Operational role — can create/edit but cannot deactivate venues, cancel matches, or assign roles. |
| **Player** | End customer who browses, books, and pays for matches. Default role on registration. |
| **AED** | UAE Dirham — assumed currency for the UAE market (confirm with backend team if currency is configurable). |
| **Platform Tenant** | The special system tenant (slug: `platform`) that houses the platform admin user. Not accessible via any public subdomain. |

---

*Document version: 2.0 | Updated: 2026-04-05 | Status: Ready for design*
