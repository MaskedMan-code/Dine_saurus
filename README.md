# Dine_saurus V3.1 commercial pilot candidate

Existing React 19 / TypeScript / Vite / Tailwind restaurant application with Supabase Auth,
PostgreSQL, RLS, RPC ordering and Realtime. The V3 stabilization branch preserves the existing
green, slate, terracotta and sage interface.

**Release status: implemented locally; managed staging and operational approval required.**
V3.1 adds trusted owner/staff provisioning, server-enforced password activation, billing/offline
payment records, receipts, KOT, cashier reconciliation, server metrics, branding and schedules.
Both V3 migrations are now deployed externally and their contracts were verified read-only.
The three new V3.1 migrations and Edge Function have not been deployed. No production write,
payment-provider activation or merge was performed. This is not a completed pilot certification.

Start with [V3.1 architecture/status](docs/V3_1_ARCHITECTURE.md),
[deployment](docs/V3_1_DEPLOYMENT.md) and [test results](docs/V3_1_TESTING.md).

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
The existing V3 guest-order/service contracts are present in production. The live history uses
different V3 timestamps from the local files: review the [history mapping and three V3.1 migrations](docs/V3_1_DATABASE_MIGRATIONS.md)
before any deployment. Do not blindly reapply older migrations over V3.1 authorization helpers.

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

- [V3.1 architecture and status](docs/V3_1_ARCHITECTURE.md)
- [Complete changed-file map](docs/V3_1_FILES.md)
- [V3.1 security audit and privacy review](docs/V3_1_SECURITY_AUDIT.md)
- [V3.1 database migrations and rollback](docs/V3_1_DATABASE_MIGRATIONS.md)
- [Trusted restaurant/staff onboarding](docs/V3_1_RESTAURANT_ONBOARDING.md)
- [Bills and receipts](docs/V3_1_BILLING.md)
- [KOT](docs/V3_1_KOT.md)
- [Payment recording and reconciliation](docs/V3_1_PAYMENT_RECONCILIATION.md)
- [V3.1 testing and limits](docs/V3_1_TESTING.md)
- [Deployment/environment variables](docs/V3_1_DEPLOYMENT.md)
- [Restaurant acceptance run](docs/V3_1_RESTAURANT_DEMO.md)

Historical V3 reports:

- [Audit and remaining risks](docs/V3_AUDIT.md)
- [Repairs and file map](docs/V3_FIXES.md)
- [Manual-test follow-up fixes and database rollout](docs/V3_FOLLOWUP.md)
- [Supabase security, migration and rollback](docs/SUPABASE_SECURITY.md)
- [OTP-free onboarding and trusted provisioning design](docs/OTP_FREE_ONBOARDING.md)
- [Test setup, results and limits](docs/TESTING.md)
- [Restaurant demonstration guide](docs/RESTAURANT_DEMO_GUIDE.md)

DOB/verified guest loyalty/reviews, full POS modifier selection, automated account-delivery
channels, customer privacy export/deletion/retention automation, overnight scheduling, provider
payments/subscription checkout and verified GST tax invoicing remain incomplete. Existing
controls disclose those limits. Receipts are labelled as receipts; offline entries do not prove
a transfer. Managed Auth/Realtime, concurrent clients, physical devices/printers, tax/privacy
review, backups and explicit production approval remain required before commercial pilot use.
