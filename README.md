# Dine_saurus V3

Existing React 19 / TypeScript / Vite / Tailwind restaurant application with Supabase Auth,
PostgreSQL, RLS, RPC ordering and Realtime. The V3 stabilization branch preserves the existing
green, slate, terracotta and sage interface.

**Release status: review and staging validation required.** Frontend repairs and automated
local tests are implemented. The SQL migration has not been applied to the live project.
New ordering, staff-access and settings RPCs must be installed in a safe development project
before an integrated demonstration. Administrator account provisioning and mandatory first
password change are documented designs, not deployed services.

## Local setup

Use Node.js 22 or newer; verification used Node 24.12.0. npm is the canonical package manager.

```powershell
Copy-Item .env.example .env.local
# Fill in your development project's URL and public key.
npm.cmd ci
npm.cmd run dev
```

On other shells, use `npm` in place of `npm.cmd`. Open the URL printed by Vite (normally port 3000).
`.env.local`, dependency folders, build output, test traces and npm cache are gitignored.

Configure only browser-safe values:

| Variable                        | Purpose                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Your development Supabase project URL                                                               |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Preferred public publishable key; alternatively use `VITE_SUPABASE_ANON_KEY`                        |
| `VITE_SUPABASE_ANON_KEY`        | Legacy public anon key, supported for compatibility; set one key option                             |
| `VITE_GEOAPIFY_API_KEY`         | Optional public, domain-restricted address autocomplete key; manual location entry works without it |
| `VITE_DEBUG_LIFECYCLE`          | `true` enables development-only lifecycle diagnostics                                               |

Never put a Supabase secret/service-role key, database password or SMTP credential in a `VITE_`
variable. Vite exposes these variables in browser assets. The Vite configuration rejects
known Supabase secret/service-role keys. Restart Vite after changing environment values.

## Routes and use

- Operator sign-in: `/?view=pos` (also the default root). Existing authorized operators use email/password.
- Staff modules: `view=kds`, `tables`, `menu`, `service_desk`, `analytics`, `loyalty_admin`, `settings`, `admin_users`.
- Guest QR: `/?view=customer&table=<persisted-token>`. The table's QR action builds this URL.
- Public browsing: `/?view=customer&restaurant=<slug>`. A valid table QR is required to order.

Guests can browse, customize a cart, enter their full name and mobile, order without an Auth
account, and track the confirmed order. No email, password or OTP is requested. Mobile numbers
are unverified contact information. Tracking receipts expire after 24 hours and are stored in
the current tab's session storage; they do not unlock other orders or loyalty information.

Staff and guest routes resolve tenancy independently. A signed-in owner scanning another
restaurant's QR sees that QR's public menu. Staff management always resolves from the owner's
database membership. Invalid QR codes fail visibly rather than falling back to another tenant.

## Database review

The historical `supabase_phase1_phase2_migration.sql` is retained as reference; it is not a full
fresh-project bootstrap and does not match every live function. Do not rerun it on production.

Review [the V3 migration](supabase/migrations/20261109125008_v3_stabilization.sql) and
[the permissions/catalog follow-up](supabase/migrations/20261109191729_v3_menu_refresh_permissions.sql),
in that order, with the [security/deployment instructions](docs/SUPABASE_SECURITY.md).
The SQL targets the inspected existing schema. The tests use schema-only fixtures with synthetic
records, never production rows. No production accounts, orders, policies or migrations were changed.
Guest ordering and service-request permissions still require the approved database deployment.

## Verification

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd audit
```

The browser configuration uses a local Vite server and mocked Supabase HTTP/websockets on a
reserved `.test` domain. It uses installed Google Chrome; install it with Playwright if needed.
These checks complement the local PostgreSQL tests and do not substitute for managed Supabase,
physical-device scanning, real account sign-in or concurrent-client staging tests.

## Documentation

- [Audit and remaining risks](docs/V3_AUDIT.md)
- [Repairs and file map](docs/V3_FIXES.md)
- [Manual-test follow-up fixes and database rollout](docs/V3_FOLLOWUP.md)
- [Supabase security, migration and rollback](docs/SUPABASE_SECURITY.md)
- [OTP-free onboarding and trusted provisioning design](docs/OTP_FREE_ONBOARDING.md)
- [Test setup, results and limits](docs/TESTING.md)
- [Restaurant demonstration guide](docs/RESTAURANT_DEMO_GUIDE.md)

DOB collection, guest loyalty redemption/reviews, full POS modifier selection, payments,
subscription purchases and verified operating-hours configuration remain incomplete. Their
controls either explain the limitation or avoid reporting success. See the audit for detail.
