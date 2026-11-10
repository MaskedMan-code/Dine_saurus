# V3.1 security review

Live inspection on 10 November 2026 was read-only. Both V3 migrations are deployed externally;
their required RPC, grants, service policies and nine publication entries are present.
The V3.1 SQL and Edge Function have not been deployed to production. Tests use synthetic local
data. No production credentials, account records, orders or customer contacts were used in tests.

| Finding | Prepared/implemented response | Remaining verification |
| --- | --- | --- |
| Browser roles retain TRUNCATE on protected tables | Revoke TRUNCATE/REFERENCES/TRIGGER across existing public tables; explicitly restrict new table grants | Verify actual Data API privileges in staging; RLS does not protect TRUNCATE |
| Staff could write misleading audit events through broad legacy grants/policy | Audit table becomes browser SELECT-only; remove the permissive write policy | Managed impersonation attempts |
| Profiles have duplicate unwrapped auth policies | Remove the duplicate policies; retain reviewed own-row and member reads | Advisor/query-plan rerun |
| Two missing private receipt FK indexes | Add indexes for guest intent `order_id` and `qr_id` | Representative staging query plans |
| No trusted onboarding or first-password enforcement | Allowlisted platform admins; service-only provisioning; SQL credential gate; expiring temporary credentials; fresh login after global revocation | Real GoTrue password/session/failure-path acceptance |
| Restaurant owner could take over a shared account through reset | Deny owner resets of other-tenant identities, platform identities and privileged/self targets; require platform administration | Two-tenant managed Auth acceptance |
| Payment state could bypass cashier authorization/ledger | Scoped cashier permissions; immutable bills/ledger; checked discounts/refunds; legacy cash action delegates to ledger | Managed retries/concurrent settlements |
| Entitlements trusted only in frontend | SQL account restrictions, location/user limits, billing/KOT checks; suspended/expired organizations cannot create guest orders | Staging expiry and direct API tests |
| Required anonymous definer RPC warnings | Keep validated QR resolution, guest profile/order/service and capability tracking endpoints; no broad anonymous order-table grants | Abuse testing, edge rate limiting, token redaction |
| Thirteen authenticated definer warnings at baseline | Review intent and caller checks; new service-only RPCs explicitly deny browser execution; new browser RPCs check caller and scope | Rerun advisors after approved deployment; review every exposed signature |
| Private RLS tables without policies | Intentional deny-by-default storage accessed only through checked definer code | Schema exposure/grant checks |
| Leaked-password protection disabled | No unapproved Auth setting change | Enable/review availability in staging and production with approval |
| 31 overlapping-policy findings / 48 unused-index findings | Do not blanket-drop public/staff access paths or security indexes | Consolidate only with policy equivalence and representative plan evidence |

Platform access requires both a trusted private allowlist row and a confirmed Auth email.
User-editable metadata, organization codes and frontend flags cannot grant that access.
All protected functions use fixed/empty search paths and explicit grants. Revocation checks
membership/employee status on each database operation instead of trusting cached JWT roles.

Provisioning never takes over an unrelated existing email. A recoverable reserved operation
does not grant membership until its transaction completes. There is no automatic deletion of
an uncertain Auth user. Same-request retries reconcile it; abandoned reservations require a
trusted review/reset. Credentials are returned once over the authenticated response with
`Cache-Control: no-store`; UI clearance never submits another account-control action.

Receipts and KOTs are authenticated staff documents. Print text is escaped; no bearer tracking
token is included. Public tracking remains a 24-hour capability without private contact/history.
Browser and Edge code do not log tokens, passwords or request bodies. Third-party image URLs
are owner-configured HTTPS; review image hosting and deployment CSP before a pilot.

## Privacy and legal review

Guest name/mobile remain unverified operational contacts, not proof of identity. Matching a
number cannot expose previous visits. DOB/marketing are not required by checkout. No automatic
retention sweep, verified identity-claim workflow, customer self-service export/deletion portal
or complete privacy case-management system is implemented. Handle verified requests through
the restaurant's approved process, restrict access, record the decision, and preserve financial
records where lawful retention requires it. Define retention, processor contracts, notices,
breach procedures, marketing consent/withdrawal and children's-data handling with counsel.

India's current privacy rules and commencement provisions require qualified review against
the actual launch date and processing activities; this repository makes no compliance claim.
Primary sources: [MeitY DPDP Rules 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025%3B),
[official Gazette text](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf).

Supabase remediation references: [function privileges](https://supabase.com/docs/guides/database/functions),
[RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select),
[foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys),
[overlapping policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
