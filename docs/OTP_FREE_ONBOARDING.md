# OTP-free onboarding

**V3.1 update:** the trusted Edge Function and server password gate described below are now
implemented and locally tested, but not deployed. Use [V3.1 onboarding](V3_1_RESTAURANT_ONBOARDING.md)
and [deployment](V3_1_DEPLOYMENT.md) for the current workflow. The design section below is the
historical V3 plan, not a claim that the new backend remains unimplemented.

## Diners — implemented application flow

Scan table QR → browse menu → choose modifiers/items → enter full name and mobile → place order
→ track the server-confirmed order. No Supabase Auth account, email, password or OTP is required.

Checkout requires 2–120 name characters and a mobile number with 7–15 digits, optionally formatted
with a leading `+`, spaces, parentheses or hyphens. The server validates the same details. The
number is unverified and never grants access to previous visits, profiles or loyalty balances.
Tracking uses an unpredictable order-specific capability stored in the current tab, with a
24-hour server limit. Refresh restores the order without placing it again.

Birth date is optional in the existing server profile signature but is not collected by this
checkout. Before adding the field, require explicit optional consent, explain its purpose and
retention, allow withdrawal/deletion and avoid bundling it with ordering or marketing consent.
Ordinary guests cannot edit another person's record, claim loyalty or retrieve history by phone.

New guest orders create customer visit records for staff CRM. Duplicate unverified numbers are
allowed safely as separate visits. Any future account claim/merge must verify identity; entering
the same number is insufficient. Customer authentication is optional future work.

## Operators — implemented sign-in

Existing authorized operators sign in with email/password. Authentication and profile/permission
loading are distinct. A missing profile, pending membership or suspended employee shows an
access error/retry instead of pretending the session was logged out. Owners/admins without a
restaurant can complete the persisted onboarding wizard. Managers/staff wait for owner setup.

The public browser signup/team-code form has been removed. The prepared database trigger no
longer trusts editable signup metadata to create organizations, memberships or privileged roles.
Existing memberships and restaurant data are preserved.

## Historical V3 provisioning design

At the V3 cutoff the branch did not include the trusted backend or password gate. V3.1 now
implements a temporary-credential workflow with manual approved delivery and a SQL gate;
managed integration/deployment remains required. The following original design includes
optional future invitation-token delivery; that invitation transport is not implemented.

1. An independently authorized Dine_saurus platform administrator opens a protected server or
   Edge Function. Verify the caller's access token with Supabase Auth, then check a server-owned
   platform-administrator allowlist/role. A restaurant owner is not automatically a platform admin.
2. Verify the target organization, permitted role, existing invitations and intended locations
   server-side. For an invitation, store a random single-use, hashed, expiring invitation token
   and the server-chosen organization/role; never accept a requested owner/admin role from signup
   metadata. Approval must come from an authorized administrator. Protect the last active owner.
3. Generate a strong unique temporary password on the server. Use the Supabase Auth Admin API
   only there; confirm email only after the administrator has established the intended recipient
   through an approved process. Create/update a profile and authoritative organization membership,
   employee status and location assignments through a trusted, audited transaction/workflow.
   Handle partial Auth/database failures with idempotent provisioning IDs and compensation.
4. Set a server-owned `must_change_password` restriction before activating protected operations.
   Enforce it in RLS authorization helpers and every privileged RPC, using authoritative server
   state. A frontend route guard or user-editable metadata is not sufficient.
5. Deliver credentials through an approved secure channel separate from application logs; do not
   put passwords in URLs, analytics, support tickets or repository files. Delivery is an explicit
   administrator action; this branch sends no messages or credentials.
6. First login can access only a password-change workflow. A trusted authenticated endpoint
   validates the caller/recent authentication, updates the password through the supported Auth
   API and clears the server-owned restriction only after success. Keep the restriction if any
   step fails, revoke/rotate temporary sessions as appropriate and test direct RPC bypass attempts.
   Normal application login remains email/password, without introducing an OTP requirement.
7. Expire unused invitations/temporary credentials, audit role/activation changes and require
   explicit authorized approval for privileged promotions. Do not automatically turn a pending
   staff signup into an admin when someone clicks Approve.

The prepared `set_staff_access` RPC synchronizes role, membership activation and employee status
for **existing** members. The Users screen does not create Auth users, provision organizations,
assign locations or implement credential delivery. Administrators must include real
`staff_location_assignments` and an appropriate `role_id` when preparing non-owner staff accounts.

## SMTP and recovery later

Configure a verified sender domain/custom SMTP provider in Supabase Auth settings, store its
credentials only in trusted settings, and configure the application's Site URL and allowed
confirmation/recovery redirect URLs. Validate real delivery, expiry and password recovery in
staging. Normal password sign-in must not be replaced with OTP to work around email-rate limits.
Do not weaken confirmation, password or RLS checks to avoid provider limits.

See [Supabase security](SUPABASE_SECURITY.md) for rollout constraints and
[testing](TESTING.md) for what has actually been exercised.
