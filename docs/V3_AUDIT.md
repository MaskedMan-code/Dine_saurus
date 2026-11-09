# V3 audit — 9 November 2026

## Scope and evidence

Work is on `fix/v3-stabilization`, based on the existing local repository. The original tree was
clean. Canonical source, components, configuration, seed exports and historical SQL were
inspected before edits. Every numbered copy was compared with its canonical file.

The connected Supabase project was matched to the configured project URL. Inspection was
read-only: table/column/constraint definitions, enum values, function definitions/ACLs, policies,
triggers, Realtime publication membership and security/performance advisors. No production
user/customer/order data was selected for tests; no production mutation or migration was run.
The schema-only fixtures contain no production records or credentials.

## Findings and disposition

| Finding                                                                                | Repair / remaining work                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 92 numbered duplicates                                                                 | Removed after comparison. All source copies were byte-identical. The two alternate npm lockfiles differed only in eight `peer` metadata entries; the canonical lockfile retained those entries. No unique functionality was discarded.    |
| Multiple package-manager locks and example package name                                | One npm manifest/lockfile, package `dine_saurus`; stale Bun lock removed.                                                                                                                                                                 |
| Async database work inside Auth listener; duplicate initial loads                      | Synchronous listener, version-checked initialization, separate profile effect keyed by user ID, abortable profile requests, distinct authentication/authorization errors and retry.                                                       |
| Membership treated as employee record                                                  | Separate `profiles`, `organization_members`, `staff_members` and optional claimed-customer queries. Active employee status is required when a staff row exists; legacy owners/admins without that row remain supported.                   |
| Repeated focus/token events reset tenancy                                              | Tenant effects depend on stable IDs and route identity. Same-user `SIGNED_IN` / `TOKEN_REFRESHED` do not reload profiles. Initial and background catalog loading are separate.                                                            |
| QR selected after staff organization                                                   | Public route QR resolution precedes slug and is independent of staff identity. Staff routes ignore incidental QR parameters. Tenant/location/table changes are explicit privacy boundaries.                                               |
| Two random tokens per new table                                                        | One token is inserted, the persisted record is read back, and only that token enters state. A failed QR insert compensates the table insert and reports uncertain cleanup.                                                                |
| Guest Auth gate                                                                        | Removed account registration from ordinary guest ordering. Name/mobile are required; no email/password/OTP.                                                                                                                               |
| Checkout swallowed failures and charged an invisible tip                               | Visible retry feedback, synchronous submit lock, cart/details preservation, zero default tip, common rounding helper and server-checked expected total.                                                                                   |
| Duplicate orders after uncertain responses                                             | Required idempotency RPC and private receipts. The same cart/request reuses a key after network failure or refresh; a deliberately rebuilt cart receives a fresh key. Changed carts cannot silently replace uncertain requests.           |
| Guest phone reused as identity/profile authority                                       | Prepared SQL creates separate unverified visit records and never updates another guest by phone. Replaces all-phone uniqueness with verified-phone-only uniqueness without deleting rows.                                                 |
| Tracking lived only in React state                                                     | Restaurant-scoped session receipt, 24-hour client/server expiry, secure snapshot restoration, nonoverlapping polling and cleanup. Snapshots omit customer identity/contact/loyalty data.                                                  |
| Invalid hook ordering                                                                  | Repaired CustomerView, POSView, MenuAdminView and TablesFloorView; actual hook lint enabled.                                                                                                                                              |
| Writes changed UI before checking Supabase                                             | Checked returned rows/errors, resolved success booleans, error banners within dialogs, and no form closure on failed saves. Staff role/status and restaurant/location settings use prepared atomic RPCs.                                  |
| POS submitted the unrelated guest cart                                                 | POS sends its own item list and chosen table token; requires diner contact, prevents duplicate submission and keeps its draft on failed submission.                                                                                       |
| Fake CRM/analytics/customer claims                                                     | CRM now reads tenant customer records; analytical dish totals use loaded order items. Removed invented ratings, hours, preparation estimates, table 12, vehicle details, hardcoded popular IDs and growth percentages.                    |
| Realtime absent from live publication                                                  | Neither `orders` nor `service_requests` was published at inspection. Prepared migration adds them when the publication exists. Staff retains a 15-second visible-page fallback poll. Actual managed Realtime delivery remains unverified. |
| Live status function accepted arbitrary transitions and used unsupported `billed` enum | Prepared function checks assigned-location access, locks orders, restricts transitions, makes same-state retry a no-op and uses supported table statuses.                                                                                 |
| Editable signup metadata selected staff role                                           | Prepared signup trigger only creates profiles. New memberships must come from a trusted administrator workflow. Existing tenant data is preserved.                                                                                        |
| Browser-based provisioning / first password change                                     | No unsafe Admin API workaround was introduced. Secure deployment design and required server-side gate are documented; implementation is deferred.                                                                                         |

## Live advisor baseline, rechecked after local testing

These findings remain on the live project because the migration was not applied:

| Advisor                                             | Count |
| --------------------------------------------------- | ----: |
| Mutable function search path                        |     6 |
| Anonymous-executable SECURITY DEFINER functions     |     9 |
| Authenticated-executable SECURITY DEFINER functions |    11 |
| Leaked-password protection disabled                 |     1 |
| RLS initplan warnings                               |     6 |
| Multiple permissive policy findings                 |   191 |
| Unused-index information findings                   |    57 |

Public QR, service and tracking RPCs are intentional privileged interfaces. Their grants must be
reviewed together with input validation, capability checks and rate limits. The prepared patch
consolidates the reviewed sensitive/catalog policies; it does not promise that every advisor
finding disappears. Unused indexes were not dropped based solely on an advisor observation.

## Release limitations

1. The V3 SQL and frontend require a coordinated staging rollout. The frontend deliberately
   does not fall back to unsafe legacy order submission if the new RPC is missing.
2. No safe managed test project, operator credentials or physical restaurant devices were
   supplied. Local SQL and mocked-browser checks do not establish end-to-end production readiness.
3. Provisioning, invitation approval/location assignment setup and first-password-change
   enforcement require a trusted server/Edge Function. The Users screen updates existing access;
   it does not create Auth accounts or deliver credentials.
4. Optional DOB is not collected by the MVP checkout. Add explicit consent/retention controls
   before exposing this field. Guest loyalty redemption/reviews are deferred until ownership can
   be verified; entering a phone number grants neither capability.
5. POS supports simple QR dine-in items. Items requiring modifier choices fail server validation
   until a POS modifier picker is implemented; the customer menu supports modifiers.
6. Payment gateways, refunds, subscription upgrades, entitlement enforcement, currency changes,
   operating-hours editing and CSV export remain deferred or read-only. Orders are unpaid until
   restaurant staff records payment through an authorized server operation.
7. CRM stores guest visits separately; phone equality must not automatically merge identities.
   Analytics describes the selected location's loaded orders, not a complete accounting report.
8. Per-QR successful-request limits are implemented in SQL. Failed transactions roll back their
   rate increments; IP/device limits and distributed abuse protection require an Edge/WAF layer.
9. Multi-session contention, managed Auth token rotation, email/SMTP recovery, Realtime reconnects
   over actual network outages and real printed-QR readability still need staging/device tests.

See [TESTING](TESTING.md) for executed commands and [the demo guide](RESTAURANT_DEMO_GUIDE.md)
for the remaining acceptance run. This branch is a draft release candidate, not a production
security certification.
