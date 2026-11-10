# V3.1 deployment and operational gates

V3.1 has not been deployed. Production database/Auth/settings changes and payment activation
require explicit approval. No branch is merged automatically. Read the
[migration-history mapping](V3_1_DATABASE_MIGRATIONS.md) before any CLI database push.

## Environments

Browser values remain in `.env.local` (ignored): `VITE_SUPABASE_URL`, one of
`VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`, optional restricted
`VITE_GEOAPIFY_API_KEY`, and development-only `VITE_DEBUG_LIFECYCLE`. Never put secrets in VITE
variables. Production diagnostics should remain disabled.

The Edge Function needs server-only `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` (normally injected by Supabase), plus `PILOT_ALLOWED_ORIGINS`, a
comma-separated exact list of approved frontend origins. No wildcard or absent-origin access
is enabled. The function explicitly validates user JWTs and authoritative actor permissions.
Keep JWT verification enabled in the deployment gateway. No SMTP, SMS or payment-provider
credential is required: delivery is manual, and payments are offline records.

## Staging procedure

1. Create/obtain an approved isolated project or sanitized clone. Back up schema, grants,
   policies, Auth configuration and relevant data through the approved process. Confirm restore
   access and retention. Do not copy customer/credential data into source fixtures.
2. Verify the existing V3 schema/history mapping. Review and apply the three exact new migrations
   in the order documented. Confirm transaction failures roll back and RPC cache is reloaded.
3. Type-check with the committed Deno config/lock. After authorization to deploy to the staging
   target, use the installed CLI's supported command (inspect `--help` if upgrading):

   ```powershell
   npx supabase functions deploy pilot-admin --project-ref <STAGING_REF> --use-api --import-map supabase/functions/pilot-admin/deno.json
   ```

   Configure `PILOT_ALLOWED_ORIGINS` through the trusted secret-management process. Do not pass
   service keys/passwords in shell history or commit env files. Do not use `--prune` or disable
   JWT verification as a shortcut.
4. Bootstrap a verified platform administrator through the trusted database process. Exercise
   [onboarding](V3_1_RESTAURANT_ONBOARDING.md), all managed [test gates](V3_1_TESTING.md), the
   [restaurant demo](V3_1_RESTAURANT_DEMO.md), advisors and financial reconciliation.
5. Review leaked-password protection, MFA for privileged operators, JWT lifetimes, CSP/security
   headers, TLS, API/WAF abuse limits, log redaction and alerts. Do not remove public QR RPCs
   merely to eliminate advisor warnings. Define incident ownership and support escalation.

## Production approval and rollback

Only after explicit approval and staging/legal/physical-device acceptance, coordinate compatible
frontend, SQL and Edge releases. The new staff gate fails closed if its SQL is absent; deploy
database/backend prerequisites before exposing V3.1 staff pages. QR browsing retains the public
contract. Smoke-test grants, real order retries, KDS, bill/payment/receipt/KOT, account suspension
and cross-tenant denial. Do not activate a payment gateway or SaaS provider checkout.

Use the reviewed rollback/forward-fix procedure in [DATABASE_MIGRATIONS](V3_1_DATABASE_MIGRATIONS.md).
Backups must cover financial/audit rows and Auth configuration; exercise restoration in isolation
before launch. Monitor RPC error rates/timeouts, unconfirmed provisioning, pending orders,
Realtime disconnects, payment retries, cash variances and advisor changes without recording
passwords, diner contact fields or tracking capabilities. Automatic monitoring/alert delivery and
automated privacy retention remain operational work, not deployed services in this repository.
