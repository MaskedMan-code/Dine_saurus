# Trusted restaurant and staff onboarding

Implemented locally; real Auth delivery/activation acceptance requires staging deployment.
Normal operator login remains email/password without OTP. Customers remain OTP-free QR guests.

## Bootstrap a platform administrator

Use a separately secured, confirmed Supabase Auth account, verified by the platform operator.
After explicit deployment approval, a trusted database administrator may insert that account's
UUID into `private.platform_administrators`. There is deliberately no browser bootstrap or
self-promotion endpoint. Review the identity/confirmed email and audit the bootstrap in the
operator's access-change process. Do not derive access from a domain, join code or user metadata.
Use strong credentials and review MFA/session policies before commercial use.

Open `/?view=platform_admin`. Ordinary restaurant owners are denied. The platform interface can
provision owner accounts/organizations, view operation status/audit history, reset owner
credentials and configure trial/access limits, suspension and billing/KOT entitlements.

## Restaurant owner

1. Verify the intended owner's email and choose an approved secure delivery channel.
2. Enter organization, owner name/email, country, currency and timezone. New organizations get
   a 30-day manual pilot trial, one location and ten users until the platform changes limits.
3. Create the account. The backend reserves a request, creates/recovers only its marked Auth
   identity, then completes membership/credential state transactionally.
4. Deliver the displayed temporary credential manually through the approved channel. Nothing
   is emailed or messaged automatically. Clear it from the screen after handoff. If delivery or
   the response was lost, retry the original request; a completed retry does not reveal the old
   password. Use an authorized reset for a new credential.
5. The owner signs in, verifies their current temporary password and sets a different password
   of 12–128 characters. Auth policy may impose stronger requirements. The Edge Function revokes
   existing sessions, releases the SQL gate and requires a fresh login. Older JWTs remain denied.
6. The existing setup wizard creates the restaurant, initial location, area, tables and saved
   QR tokens once. Repeating setup is rejected. New tax/service defaults are zero; configure
   reviewed rates/settings before accepting live orders.

Temporary credentials expire after 24 hours and cannot perform protected operations. A direct
Auth password update does not release the database gate. Expired/pending resets require the
administrator. Existing-account attachment is deliberately not automated merely by matching
email; shared identities need a reviewed platform process.

## Staff

An owner opens Users and provisions manager, cashier, waiter, kitchen or other staff with one
or more same-organization locations. Duty/location edits, activation/deactivation and existing
last-owner protections run through checked SQL. Staff receive unique credentials and the same
mandatory activation flow. Cashiers cannot refund; managers cannot promote themselves to owner.

Owners can reset eligible nonprivileged, restaurant-only accounts. Resetting a shared identity,
a platform identity, an owner/admin or the acting owner's own account requires platform
administration. Reset preparation locks protected access before Auth changes occur. Review
recent organization activity from Users; platform activity is separate.

Partial failures preserve a visible reservation and retry key. Do not create repeated accounts
while a request is uncertain. Unfinished Auth identities have no new membership until completion;
investigate abandoned reservations through the trusted backend process. No shared passwords,
automatic invitation email delivery, existing-user merge, or join-code self-enrollment is claimed.
