# Testing and verification

This is the historical V3 result record. Current V3.1 results and four-viewport coverage are in
[V3_1_TESTING.md](V3_1_TESTING.md); baseline results below are retained for traceability.

## Commands

Verification was performed on Windows with Node 24.12.0. PowerShell script execution policy
blocked `npm.ps1`, so actual commands use `npm.cmd` (the same npm CLI):

```powershell
npm.cmd ci --cache .cache/npm
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd audit --json --cache .cache/npm
```

Results include the manual-test follow-up checks on 10 November 2026. Install/audit results
remain from 9 November; those commands were not repeated for the follow-up. Tests are
self-contained and do not need a real project key or production credentials.

| Check                                      | Final result                                                   |
| ------------------------------------------ | -------------------------------------------------------------- |
| Clean lockfile install                     | Passed; 325 packages installed, zero audit findings at install |
| TypeScript + React hook lint               | Passed; no errors or warnings                                  |
| Vitest component/unit/Postgres regressions | Passed; 53 tests across 6 files                                |
| Vite production build                      | Passed; nonblocking 711.01 kB bundle warning (191.22 kB gzip)  |
| Playwright desktop/mobile                  | Passed; 26 tests (13 workflows x 2 viewports), 50.1 seconds    |
| Dependency audit                           | Passed; 0 vulnerabilities, including development dependencies  |

An initial install failed because a running Windows process locked a native dependency. Its
old folder was preserved as ignored `node_modules.locked/`; the clean install then succeeded.
It can be removed after the other process releases the file. The first test runs also found
and helped fix the phone-uniqueness contract mismatch, unsupported `billed` enum, inaccessible
cart action and moving tracking button. Earlier failures are not counted as passed tests.

## Local PostgreSQL tests

`tests/database.test.ts` creates an isolated PGlite PostgreSQL database from schema-only
fixtures. The fixture includes the inspected public schema, constraints, indexes, policies,
functions, triggers and identity columns, with a synthetic `auth.uid()`/Auth table. Tests create
only synthetic users, tenants, menus, tables and orders in memory.

Coverage includes migration application/reapplication, anonymous catalog access, non-enumerable
QR tokens, cross-tenant QR context, invalid/revoked tokens, guest pricing/modifiers/quantity,
unverified identity isolation, transactional expected totals, sequential idempotency, tracking
privacy/expiry, protected order writes, assigned employee status, role/owner safeguards, RLS
parent consistency, settings authorization, onboarding retry rejection, service limits and
Realtime publication metadata.

The follow-up fixture reproduces the live helper's restricted ACL rather than inheriting
PostgreSQL's default PUBLIC EXECUTE. Tests first reproduce the authenticated service-read
failure, then apply both migrations and verify location/customer isolation, anonymous denial,
caller-bound helper results and catalog publication membership. Applying only the follow-up
fails and rolls back when the checkout RPC prerequisite is missing.

PGlite does not run Supabase Auth/GoTrue, PostgREST, a logical-replication server or multiple
concurrent client connections. This is real SQL execution, not a managed Supabase integration
test. Do not use the test fixture as a production migration or full application bootstrap.

## Component and unit tests

- Auth restoration, initialization/sign-out races, stale profile cancellation, missing-profile
  errors, stable same-user token events and StrictMode listener cleanup.
- Deterministic multi-organization resolution and employee activation.
- Required guest contact details, visible checkout failures/cart preservation, synchronous
  double-click protection and delayed success until server confirmation.
- Persisted QR readback and compensation on failed QR insert.
- Idempotency across uncertain retries, distinct intentional repeat orders, protection against
  replacing an uncertain request, tracking scoping/expiry and independent monetary rounding.
- Editor/quick-action location stock parity, preservation of price overrides and publication,
  failed writes and unpublished new-item cleanup; coalesced in-flight catalog refreshes.
- Filtered catalog subscriptions, hidden-page polling, reconnect/visibility refresh and
  StrictMode/tenant-change cleanup; checkout scroll region and body-lock restoration.
- A missing ordering RPC retains the idempotent intent for retry after deployment and never
  calls the legacy ordering endpoint.

`npm run lint` includes actual React `rules-of-hooks` and dependency lint, not only TypeScript.
StrictMode and Supabase automatic refresh remain enabled.

## Browser tests

`playwright.config.ts` starts a dedicated local Vite server on `127.0.0.1:3107`, overrides the
project URL with `https://supabase.example.test` and mocks every backend HTTP/websocket request.
The suite never writes to the configured live project. It runs desktop and Pixel-sized mobile
layouts in installed Google Chrome. If unavailable, install Chrome using Playwright's supported
installer before running. The test configuration fails rather than reusing an unknown server.

The workflows cover operator login, active module/session refresh, tab switching without a new
document or extra profile fetch, QR priority over signed-in staff context, invalid QR feedback,
OTP-free guest checkout/tracking restoration, checkout failures, onboarding draft restoration,
logout/login and Realtime protocol-driven KDS updates without duplicate cards/subscriptions.
The table workflow creates a QR, downloads its PNG, decodes the actual image using `jsqr`, checks
the persisted token and navigates the decoded URL. This is automated QR decoding, not a claim
that physical camera scanning or printed readability has been tested.

Failure traces and layout screenshots are written under ignored `test-results/`. Only synthetic
fixture details appear in those artifacts. Customer-menu tests also check document overflow at
both viewport sizes.

The follow-up adds two-session editor-to-guest stock/name/price updates with an open cart,
unpublished-item polling without an event, actual scrolling at a 390 x 480 viewport, and a
missing-RPC checkout error. Guest inputs/cart survive refreshes; checkout controls remain
reachable and the page behind it stays locked. These use mocked HTTP/websockets, not the
production database or managed Realtime service.

## Required managed staging acceptance

After an explicitly approved development-project migration, execute
[RESTAURANT_DEMO_GUIDE](RESTAURANT_DEMO_GUIDE.md) using two real test tenants. In particular test:

1. Real Auth refresh/recovery/role changes, first-password-change gate once implemented and
   direct API attempts that bypass the UI.
2. RLS/RPC behavior through PostgREST as anon, owner, manager, active assigned staff, inactive
   staff and another tenant, with actual Data API grants.
3. Simultaneous duplicate requests over independent connections, unknown-response retries,
   menu changes during checkout and shared-table order/session contention.
4. Real Realtime publication/RLS delivery, disconnect/reconnect, POS/KDS synchronization,
   polling fallback and location/restaurant switching.
5. A separate phone scanning a printed QR, refresh-safe tracking, CRM visits and real server
   totals. Do not perform destructive tests on customer data.

Live security/performance advisors were re-read after local testing; their findings remain on
the untouched production project. Detailed counts and limitations are in [V3_AUDIT](V3_AUDIT.md).
