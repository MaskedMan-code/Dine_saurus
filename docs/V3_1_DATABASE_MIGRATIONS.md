# V3.1 migrations and history reconciliation

Never apply these automatically to production. They target the inspected existing schema,
not an empty Supabase project. The fixtures are test-only and must never bootstrap production.

## Existing V3 state

Read-only inspection confirms the live entries `20261109213730_v3_stabilization` and
`20261109213739_v3_menu_refresh_permissions`. Their names/contracts correspond to local files
`20261109125008_v3_stabilization.sql` and `20261109191729_v3_menu_refresh_permissions.sql`, but
the recorded versions differ. Confirm definitions and keep an explicit history mapping.

**Do not blindly run `db push --include-all`, repair production history, or reapply the V3 files
after V3.1.** The older functions can overwrite newer authorization gates. A trusted operator
must reconcile the verified history mapping through a reviewed procedure before CLI pushes.
Alternatively, after approval, apply only the three exact reviewed V3.1 transactions through
the approved SQL deployment process and record their versions consistently. No history repair
or SQL deployment was performed by this work.

## Ordered new migrations

1. `20261110170915_v31_trusted_onboarding.sql`: privilege reduction, private platform allowlist,
   credential/provisioning state, access/limits, owner staff duties/assignments, platform account
   controls, audit records and reviewed new-restaurant tax defaults.
2. `20261110170918_v31_billing_kot.sql`: receipt settings/counters, immutable bills, bill-order
   links, append-only payments, authorized void/completion, cashier closing and KOT snapshots.
3. `20261110174122_v31_operations.sql`: validated opening schedules/holiday closures, branding,
   currency safeguards, real session closure and server-defined financial/operational reporting.

Each is transactional. Local tests compile and reapply them against the schema-only fixture,
retaining synthetic data. Grants and RLS are explicit. New public tables are browser SELECT-only;
checked RPCs perform writes. Currency changes with an existing menu/order history are rejected;
there is no automatic currency conversion or historical money rewrite.

Test the whole chain against a sanitized staging clone with Auth schema compatibility, not only
a SQL editor session as `postgres`. Verify anonymous/authenticated/service-role behavior via the
Data API. Check publication/RLS delivery, independent concurrent retries, deadlocks, request
limits, backups and migration failure rollback. The Edge Function must be deployed separately.

## Rollback

- A failure before a migration commits rolls back that file. Already committed earlier files
  remain and must be accounted for; this is three transactions, not one combined release.
- Prefer a reviewed forward fix. Stop new writes during an unsafe financial incident.
- Retain bills, counter history, payments, refunds, KOTs, Auth identities, orders and audit data.
  Never delete or renumber financial rows to make a rollback appear successful.
- Preserve credential gates and authoritative revocation even if the previous frontend is
  restored. Restore compatible function definitions/grants from an approved schema backup;
  do not replay old broad browser privileges or overwrite live order data with an old dump.
- Review active provisioning reservations and credential delivery separately. Disable access
  while investigating; do not automatically delete users after an uncertain Auth response.
- Verify tenant isolation, QR ordering, cashier totals and advisors after any rollback/forward fix.
