# V3.1 verification and acceptance limits

See [BASELINE](V3_1_BASELINE.md) for the independently verified V3 starting point. Commands use
`npm.cmd` because PowerShell blocks `npm.ps1`. Application dependencies did not change.

```powershell
npm.cmd ci --cache .cache/npm
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
$env:DENO_DIR=Join-Path (Get-Location) '.cache/deno'
npm.cmd exec --yes --package=deno@2.9.6 -- deno check --frozen --config supabase/functions/pilot-admin/deno.json supabase/functions/pilot-admin/index.ts
```

The Edge import and generated `deno.lock` pin Supabase JS 2.112.3. Deno type-checking and a local
esbuild entry bundle passed; neither is a deployed Edge Function integration test.

Actual final results on 10 November 2026:

| Check | Result |
| --- | --- |
| Clean npm lockfile install | Passed; 325 packages, zero audit findings; no npm dependency changes afterward |
| TypeScript and React hook lint | Passed with no errors/warnings |
| Unit/component/local PostgreSQL/Edge contracts | 78 tests passed across nine files |
| Production Vite build | Passed; 760.53 kB main chunk (206.05 kB gzip), existing size warning; print renderer split into a separate 189.75 kB chunk |
| Chrome browser suite | 76 passed (19 workflows × four viewport sizes), 2.2 minutes |
| Edge Function | Deno 2.9.6 type check and local esbuild entry bundle passed; dependency lock generated |

Initial implementation checks
found ambiguous SQL variables and a missing exact accessible select label; both were corrected
and their workflows rerun. Earlier failed attempts are not counted as passing tests.

## Automated coverage

- Existing V3 Auth/session/tenant/QR/cart/tracking/menu/checkout regressions remain.
- Real local PostgreSQL execution in PGlite applies/reapplies the migration chain, creates only
  synthetic actors/tenants/orders and checks privilege reduction, caller authorization,
  first-password direct-RPC denial, stale JWT claims, provisioning retries, owner setup,
  expiration, shared-account reset denial, locations/duties and account/limit enforcement.
- SQL tests cover server totals/discounts, receipt sequence/uniqueness, combined sessions,
  partial/duplicate/external payments, overpayment, refund authorization, cashier closing,
  immutable ledger access, void/cancellation, paid completion, KOT lifecycle/reprints,
  server financial metrics, schedules/holidays and real table-session closure.
- Edge handler contract tests use mocked Auth/service clients to verify ordering and fail-closed
  behavior. They do not prove GoTrue transaction/session behavior. Client tests verify preserved
  retry UUIDs, no stored provisioning contact/password, print escaping, paper styles, hours and
  readable brand contrast.
- Playwright uses synthetic HTTP/websocket routes on `supabase.example.test`, never live data.
  It runs desktop 1366×768, tablet 768×1024, mobile 390×844 and short mobile 375×667 in Chrome.
  Workflows include V3 regressions plus credential activation, platform denial/provisioning,
  offline cashier payment/receipt layouts, KOT reprints, financial empty states and offline carts.

## Mandatory managed staging gates

Use a sanitized isolated Supabase project and real test identities. Verify every browser role
through PostgREST, service-only function denial, confirmed platform bootstrap, real Auth create/
reset/password change, expiration and global refresh-session revocation. Confirm old JWTs fail
and a fresh password login succeeds. Test Auth-response loss/database failure and same-request
recovery without duplicate users/memberships.

Exercise two tenants and independent connections for simultaneous provisioning/limit changes,
duplicate bills/payments, refunds versus settlements, last-owner changes, session closure and
deadlock/retry behavior. PGlite is single-connection and does not run GoTrue, PostgREST or managed
logical replication. Verify actual Realtime RLS/reconnect delivery, long-running session changes,
browser restart, printed QR scanning, physical phone/tablet interaction, thermal drivers and A4.

Review account suspension during service, trial expiry, unavailable carts, stale prices,
local timezone/date boundaries, multi-location currencies and unconfirmed request recovery.
Run advisors and representative query plans after approved staging deployment. Complete tax,
privacy, retention, backup/restore, incident response and restaurant-operator acceptance before
declaring a controlled commercial pilot ready.
