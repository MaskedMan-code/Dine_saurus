# Supabase security and rollout

## Current state

The live project was inspected read-only during stabilization and the manual-test follow-up.
It still lacks `place_qr_order_idempotent`, and `current_customer_id` lacks authenticated EXECUTE.
The changes below exist only in these ordered migrations:

1. [`20261109125008_v3_stabilization.sql`](../supabase/migrations/20261109125008_v3_stabilization.sql)
2. [`20261109191729_v3_menu_refresh_permissions.sql`](../supabase/migrations/20261109191729_v3_menu_refresh_permissions.sql)

Both were executed against local PostgreSQL through PGlite with schema-only fixtures and
synthetic data. The follow-up refuses to commit without the first migration's ordering RPC.
Managed Supabase deployment and concurrent connections remain unverified. See the
[follow-up report](V3_FOLLOWUP.md) for the reproduced permission failure and frontend repairs.

Do not automatically run these migrations against production. They depend on the inspected
existing schema, not a blank project. `supabase_phase1_phase2_migration.sql` is historical and
is not a substitute for the complete schema.

## Authorization model

- `organization_members` supplies role and membership activation. `staff_members` supplies
  employee status. An active employee row alone does not grant organization access.
- Owners/admins can operate their authorized tenant; managers/staff require active membership,
  active employee status and assigned locations for order/service operations. Legacy owners or
  admins without an employee row remain supported.
- Menu changes require owner/admin/manager membership. Restaurant/location settings require
  an owner/admin. Staff access changes use one privileged, checked transaction and protect the
  last active owner. An admin cannot promote a lower-role member to admin/owner.
- Roles from editable `raw_user_meta_data` never grant access. The replacement signup trigger
  creates a profile only. New organizations/memberships require trusted administrator setup.
- RLS stays enabled. Reviewed overlapping policies are consolidated; public catalog reads
  require active/published restaurant data. Parent relationships are checked for menu items,
  modifiers, tables/areas and location settings.
- Direct order/item/status writes are revoked for browser roles. Status/payment changes remain
  secure RPCs with authoritative location checks. Customer contact updates cannot change
  verified-phone, tenant, Auth identity, loyalty points or stamps.

The table QR token list is no longer anonymously enumerable. The guest catalog receives only
the validated token from `resolve_qr_context`; staff can still read/manage authorized QR rows.

## Public guest contracts

| RPC                                                | Intended access and validation                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `resolve_qr_context(text)`                         | Anonymous/authenticated public QR capability; existing resolver checks active QR/table/location/restaurant. Existing tokens remain valid.                                                                                                              |
| `save_guest_customer_profile(text,text,text,date)` | Creates a fresh unverified guest visit after QR/contact validation; never looks up or updates another person by phone. DOB is not exposed by the MVP UI.                                                                                               |
| `place_qr_order_idempotent(...)`                   | Required browser ordering RPC; private receipt keyed by unpredictable UUID, request fingerprint equality, transactional order creation and server-checked expected total.                                                                              |
| `place_qr_order(...)`                              | Existing signature preserved for trusted/internal use; browser grants revoked. Prices, availability, modifiers, quantities, currency, QR identity, charges and totals are calculated server-side. Supplied customer IDs/prices/discounts are rejected. |
| `get_public_order_snapshot(uuid,text)`             | Unpredictable tracking capability, 24-hour expiry, no customer ID/name/phone/DOB/loyalty/history, no broad order-table access.                                                                                                                         |
| `create_guest_service_request(text,text,text)`     | Valid QR, supported request type, bounded message and table-level rate limit.                                                                                                                                                                          |

The public order wrapper intentionally remains callable by a signed-in operator using a guest
QR. It does not attach that operator's unrelated customer identity to the guest order.

Tax and service charge are rounded independently; discounts are currently zero. No online
payment is collected. A changed server total rolls the entire order transaction back rather
than accepting an unreviewed higher total. Valid modifiers are snapshotted once and used for
the persisted order, avoiding a second price lookup during item insertion.

## Guest identity and retention

The existing `customers_org_phone_unique` constraint forces unrelated diners sharing an
unverified number into the same record. The migration replaces it with a partial unique index
on **verified** non-null phone numbers. All existing rows are retained. Every new unauthenticated
visit creates a distinct customer row; an idempotent retry reuses the original order/visit.

This is a deliberate database contract change that must be reviewed before rollout. Never
merge these records or award/redeem another person's loyalty by phone equality alone. A future
claim/merge workflow must verify possession, reconcile rewards atomically and be audited.

The browser stores cart/contact drafts, order intents and tracking tokens only in session
storage, scoped to the restaurant/location/table where appropriate. Tracking has a 24-hour
limit. Staff selection and onboarding drafts use user/organization-scoped local storage hints;
they do not authorize database access. Shared-device users should clear site data when finished.

Private receipt/bucket tables have RLS and no browser grants. The migration limits successful
orders/profile requests to 30 per QR/minute and service requests to 12 per QR/minute. Failed
transactions roll back bucket increments. Add server/Edge IP/device limits and monitoring for
hostile invalid requests; table-wide limits can also affect multiple genuine diners. Schedule
trusted retention cleanup for old receipts after the operational retry window and keep order
data according to the restaurant's policy. Do not expose bearer tracking tokens in logs/URLs.

## Realtime

Read-only live inspection found neither `orders` nor `service_requests` in `supabase_realtime`.
The migration adds these tables idempotently if the publication exists; otherwise it emits a
notice requiring project setup. Confirm publication membership, RLS visibility and websocket
delivery in the development project. The frontend uses one filtered channel per authorized
location, removes it on boundary changes, refetches after reconnect and polls every 15 seconds
while visible as a fallback. Guest tracking uses nonoverlapping 5-second polling (15 seconds
when hidden), stops at terminal states and cleans up its timer.

The follow-up also adds the public catalog tables to the publication without widening their
SELECT policies. Public QR menus use a separate restaurant/location-filtered catalog channel,
coalesce events, refresh on subscription/reconnect and visibility restoration, and poll every
15 seconds while visible. Polling covers missing publication setup, deletions and rows that lose
public RLS visibility. Cart contents and diner inputs survive background refreshes.

## Staging and production procedure

1. Obtain an isolated development Supabase project or sanitized schema clone. Keep service keys
   on a trusted server only. Do not copy production customer data into test fixtures.
2. Export the target schema, function definitions, policies, grants and relevant data using an
   approved database backup process. Compare the target with this branch's inspected schema.
   In particular verify function signatures, enum values, phone constraints and existing RLS.
3. Apply both migrations in the order listed above to that development database. Each file is
   transactional and re-runnable for the inspected schema. They deliberately retain existing
   restaurant/user/order rows and tokens. The follow-up requests a PostgREST schema-cache reload.
4. Verify Data API grants, new RPC discovery, advisor output and Realtime publication membership.
   Exercise the entire [demo acceptance run](RESTAURANT_DEMO_GUIDE.md) with at least two tenants
   and separate browser/device sessions. Test simultaneous retries with multiple connections.
5. Verify that UI totals, persisted totals, status history, CRM visits and tracking restoration
   agree. Test stale/revoked QR and expired/wrong tracking tokens.
6. Run security/performance advisors again. Intentional guest SECURITY DEFINER findings need
   documented review, not blanket revocation. Remaining performance policies/indexes require
   query-plan evidence. Check leaked-password protection availability/settings separately.
7. Only after explicit production approval, coordinate compatible frontend and database releases
   in a maintenance window. Older frontends call the revoked legacy order RPC; this is not an
   independently deployable database-only change. Never enable a silent legacy fallback.

No production rollout, advisor remediation claim or real-device sign-off is included in this branch.

## Rollback plan

- A failure before `COMMIT` rolls back the migration transaction. Reproduce and fix it in the
  isolated database before trying again.
- After a rollout, pause new ordering and prefer a reviewed forward fix. Retain orders and
  idempotency receipts so uncertain client requests cannot create duplicate orders.
- Restore the approved previous frontend together with compatible function definitions,
  policies and grants from the pre-rollout schema backup. Review each restored grant; the old
  functions include known security weaknesses. Do not restore an entire old data dump over live
  orders simply to revert code.
- Keep new private receipt tables and historical records during rollback. Do not delete guest
  rows or merge them by phone. Recreating the old all-phone unique constraint can fail after
  legitimate new visits share a phone; retain verified-only uniqueness until an explicitly
  approved reconciliation/identity migration exists.
- Remove publication membership only if the rollback's intended behavior requires it. Check
  advisors, permissions and order/tracking behavior again after the coordinated rollback.
- `tests/fixtures/*.sql` is **test-only**, including synthetic Auth helpers and roles. Never run
  it as a production restore or bootstrap.

## Primary references consulted

- [Auth state change behavior](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Database functions and privileges](https://supabase.com/docs/guides/database/functions)
- [RLS and row ownership](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase changelog](https://supabase.com/changelog)

Current documentation and installed client/CLI interfaces were checked during implementation.
No paid branch/project was provisioned and no security setting was weakened to avoid email limits.
