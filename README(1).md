# Dine_saurus — Nordic Table

A multi-tenant restaurant SaaS platform (QR ordering, POS, Kitchen Display, table management,
loyalty, service desk, analytics) on a real Supabase backend, with real tenant isolation.

## Setup

```bash
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm install
npm run dev
```

The app **will not start** without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set — there
is no hardcoded fallback anymore. If they're missing you'll see a clear configuration screen
instead of a silent failure. A working `.env.local` for this project's Supabase instance is
already included so the delivered build runs out of the box; treat it as a dev convenience, not
something to commit to a public repo.

## How tenant resolution actually works now

This was the core problem in the previous version: the app loaded `restaurants.limit(1)` and
just assumed there was one restaurant in the whole database. That breaks the instant a second
restaurant signs up — which already happened once in this project's real data.

Tenant identity is now resolved by `src/context/TenantContext.tsx`, and it never guesses:

- **Staff**: resolved from their `organization_members` row → their organization's restaurants.
  If their org owns zero restaurants yet, they're routed into a real onboarding wizard instead of
  seeing someone else's data.
- **Guests/customers**: resolved from the table QR code they scanned (`?table=<token>`) or an
  explicit `?restaurant=<slug>` link. If neither is present, the app shows an honest empty state
  ("no restaurant linked to this page") rather than picking one for them.
- Registering a customer account **requires** a resolved `organization_id` — the signup trigger
  raises an error rather than guessing which restaurant a new customer belongs to.

## Real onboarding flow

Sign up (owner, no join code) → creates a new `organizations` row, owner is auto-approved →
`OnboardingWizard` walks them through creating a `restaurants` row → `restaurant_locations` row →
`restaurant_areas` row → `restaurant_tables` rows (with QR tokens) — each step writes to Supabase
and uses the real returned ID for the next step. Team members join an existing org via a 6-character
join code (shown to owners/admins in Settings → Supabase Infrastructure), and need approval from
an owner/admin in the **Users** tab before their staff tools unlock.

## Tenant isolation — what's enforced and how it was tested

- Every tenant-scoped table has RLS policies keyed off `organization_id` via `is_org_staff()` /
  `is_org_admin()` (SECURITY DEFINER helpers) or `current_customer_id()`.
- `organization_id` is **immutable after insert** on `customers`, `organization_members`,
  `staff_members`, `restaurants`, `restaurant_locations`, and `orders` — a `BEFORE UPDATE` trigger
  (`prevent_org_id_change`) raises an exception if anyone tries to change it, closing the
  "update my own row to point at a different tenant" escape hatch.
- Public menu-browsing tables (`restaurants`, `restaurant_locations`, `restaurant_tables`,
  `table_qr_codes`) are readable without auth (QR ordering has to work for anonymous guests) but
  only for rows that are actually `active`/`published` — not a blanket `USING (true)`.
- I ran this directly against the live database as a two-tenant simulation (not a mock):
  1. Created two real owner accounts via the real signup trigger → confirmed two distinct
     organizations, no shared org.
  2. As Tenant A's authenticated session: created a restaurant under their own org → **succeeded**.
  3. As Tenant A: tried to create a restaurant under Tenant B's org → **blocked by RLS**.
  4. As Tenant A: tried to read Tenant B's `organization_members` rows → **0 rows returned**.
  5. As Tenant A: tried to `UPDATE` their own restaurant's `organization_id` to Tenant B's org →
     **blocked by the immutability trigger**.
  6. Confirmed a staff-scoped restaurant fetch (what `TenantContext` actually runs) returns
     exactly one restaurant — their own.
  All test rows were cleaned up afterward.
- **Known real-world case this fixes**: a genuine user (`alisyedkabeer@gmail.com`) had already hit
  the old bug — they signed up as an owner and got attached to the shared seed organization
  because the trigger picked "whichever org was created first." Their organization_membership is
  now correctly isolated (`Syed Kabeer Ali's Restaurant`, its own org, zero restaurants yet); they
  just need to sign back in and complete the onboarding wizard.

## Data model fixes

- `restaurant_tables.status` was missing — table state was being faked from the `active` boolean
  (which only meant "enabled/disabled", not "available/occupied/reserved/cleaning"). Added a real
  `table_status` enum column, and `updateTableStatus` now persists to Supabase instead of only
  updating local React state (it used to silently drop every floor-plan status change on refresh).
- No other frontend↔schema renames were made — column names like `display_name`, `active`,
  `logo_path` stay as-is in the database; the frontend mapping layer (`src/lib/mappers.ts`)
  translates them to the existing camelCase types instead.

## TypeScript was silently broken — now it isn't

This project had no working type declarations for React at all (`@types/react` was never
installed, and this React 19 package doesn't ship its own), so `tsc --noEmit` had been passing
trivially — `useRestaurant()` and friends were resolving to `any`. I installed real types and
turned on `strict: true`. That immediately surfaced live bugs that were shipping in the previous
build:
- `ServiceDeskView` called `acknowledgeServiceRequest` / `resolveServiceRequest`, neither of which
  existed on the context — clicking those buttons would have crashed.
- `LoyaltyDrawer` read `customerProfile.availableRewards` and `reward.costPoints`, neither of
  which exist on the real types (`savedRewards` / `pointsCost`).
- A modifier group used `.isRequired` instead of `.required`.
- 43 places across `AnalyticsView`, `CheckoutDrawer`, `CustomerView`, `MenuAdminView`, `POSView`,
  `TablesFloorView`, and `Navbar` accessed `restaurant.*` without checking it could be `null` —
  safe today only because of `App.tsx`'s loading gate, now made explicit with guards so it stays
  safe if that gate ever changes.

The project now builds clean under `strict: true` — `npx tsc --noEmit` and `npm run build` both
pass with zero errors.

## Frontend → Supabase audit (per entity)

| Entity | Source of truth | Notes |
|---|---|---|
| Restaurant / Locations | Supabase, scoped by resolved tenant | was `.limit(1)`, now `TenantContext`-resolved |
| Areas / Tables / QR codes | Supabase, scoped by location | table `status` now persisted (was local-only) |
| Categories / Menu items | Supabase, scoped by restaurant | |
| Modifiers | Supabase, scoped by restaurant | was fetching *all tenants'* modifier options/junctions unfiltered — fixed to scope by the loaded modifier groups |
| Orders / order items / status events | Supabase, realtime | |
| Service requests | Supabase, realtime | |
| Reviews | Supabase | staff replies persist via `staff_reply` |
| Customers | Supabase | loyalty fields (`points_balance`, `stamps_count`, `tier`) live on the row |
| Loyalty rewards | Supabase (`customer_rewards`) | |

No business data lives in `localStorage`. The only things persisted client-side are UI
conveniences that are always re-validated against Supabase on load, never trusted blindly: the
last-selected restaurant/location id (staff), and the last-scanned table QR token (guests) — both
are just starting hints for `TenantContext`, not authoritative.

## Loading / error / empty / retry

- `TenantContext` and `RestaurantContext` both expose `loading`/`error`/`retry`; `App.tsx` renders
  a spinner, a real error message with a **Retry** button, or the actual content — never a blank
  screen or a silent wrong-tenant fallback.
- Genuine empty states are explicit: "no restaurant linked to this page" for guests with no
  QR/slug context, and the onboarding wizard itself as the empty state for a staff org with zero
  restaurants.
- `SettingsView`'s Supabase status panel now reflects `checkSupabaseConnection()`'s real result
  instead of a hardcoded "Connection Verified & Operational" string.

## Manual QA checklist

- [x] New staff account → new organization (verified via direct signup + SQL check)
- [x] New restaurant / location / area / table → real Supabase IDs (onboarding wizard, each step
      chained off the previous step's returned id)
- [x] Second tenant cannot see or write into the first tenant's data (RLS test above)
- [x] `organization_id` cannot be changed post-creation (trigger test above)
- [ ] Full browser click-through (new account → refresh → logout/login) — not runnable from this
      environment; do this manually once deployed. The underlying session restoration
      (`getSession()` + `onAuthStateChange`) and sign-out (`supabase.auth.signOut()`) are
      implemented in `AuthContext.tsx` and exercised indirectly by every SQL test above, but a
      real browser refresh/logout pass is worth doing before you rely on this in production.


## Phase 1 + Phase 2 implementation notes

This build makes Supabase the source of truth for tenant data and implements a production-oriented QR ordering path. Onboarding is atomic through `create_restaurant_onboarding`; QR context is resolved and scan-counted by `resolve_qr_context`; orders are validated and created atomically by `place_qr_order`; staff status transitions use `update_order_status_secure`; guest QR order tracking uses a short-interval secure polling RPC.

### Manual setup
1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for your Dine_saurus Supabase project.
3. For the existing Dine_saurus Supabase project used with this build, do **not** re-run the Phase 1/2 migration. The live project already contains the required database changes. Run the SQL only when setting up a new Supabase project.
4. Run `npm install` then `npm run build`.
5. Test in a clean browser session: staff signup -> onboarding -> table QR -> guest menu -> order -> KDS -> order status tracking.

### Payment note
Online payment is intentionally **not** charged in Phase 2. The checkout UI records a payment preference and creates the order as `unpaid`. Gateway integration, webhooks, refunds, and idempotency belong to Phase 3.

## Geoapify address autocomplete

Copy `.env.example` to `.env.local` and set `VITE_GEOAPIFY_API_KEY`. The onboarding Location step uses Geoapify's Address Autocomplete API to suggest addresses and automatically populate city, state/region, postcode, country, latitude/longitude, place ID, timezone, and a default currency.
