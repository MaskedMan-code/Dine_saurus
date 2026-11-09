# Restaurant demonstration guide

## Prepare a safe demonstration

Use a dedicated development/demo project with synthetic restaurant data. Review/apply the V3
SQL there, then run advisors and confirm `orders` and `service_requests` are included in the
Realtime publication. The live project was not changed by this branch. New order/access/settings
RPCs are required; the application displays a setup error if they are missing.

Prepare two isolated test organizations, owner accounts, and an active staff member assigned
to the intended location. Use a trusted administrator workflow; browser signup is no longer
available. Provisioning and first-password-change enforcement are not implemented in this
branch, so do not demonstrate them as finished. Use existing approved test accounts.

Configure the demo frontend with the demo project's public URL/key. Use an HTTPS URL reachable
from the guest phone. A QR generated from `localhost` opens the phone's own localhost; host the
frontend on an appropriate demo URL or use a suitable local-network setup. No production
deployment is performed by this repository task.

## Acceptance run — mark each item after real verification

- [ ] Owner A signs in at `/?view=pos` using email/password, with no OTP prompt.
- [ ] Dashboard loads once; select Kitchen, switch browser tabs and return. The session and
      selected module remain, with no full-screen background-loading flash.
- [ ] Owner edits/adds a category/menu item and refreshes to verify persisted data. Test a
      permission or validation failure and verify the dialog shows an error and keeps its data.
- [ ] Owner opens Floor Plan & QR and creates a table in the correct location/area. Saving must
      confirm both the table and QR. Editing an existing table preserves its printed QR token.
- [ ] Download the QR PNG, decode/scan it and verify restaurant, location and table on a separate
      device. Use the QR's Test action for a new customer tab when testing as a signed-in owner.
- [ ] Customer browses and selects items/modifiers. No account/email/password/OTP is requested.
- [ ] Checkout requires full name/mobile, shows charges without an invisible tip and explains
      that payment happens at the restaurant. Invalid details show feedback.
- [ ] Place the order. Double-click/retry or simulate a lost response safely in the demo project;
      confirm one persisted order and a preserved cart on failure. Do not claim success until
      the server confirms.
- [ ] POS/KDS receives one order card with accurate table, items and modifiers. Verify actual
      Realtime delivery and the fallback refresh after temporarily interrupting the websocket.
- [ ] Kitchen progresses pending → accepted → preparing → ready → served → completed. Invalid
      jumps and cross-tenant status calls fail; a repeated same-state call adds no duplicate event.
- [ ] Guest sees tracking updates, refreshes and reopens the same order. Wrong/expired tracking
      capabilities fail without exposing another customer's details or previous orders.
- [ ] CRM shows the new unverified visit. Reusing a number does not overwrite an older profile
      or grant loyalty access. Analytics uses real loaded-order/item totals.
- [ ] Owner A opens Restaurant B's customer QR and sees B's public menu. Returning to staff
      tools resolves A's authorized tenant. No previous table/cart/order carries across boundaries.
- [ ] Owner B cannot access A's protected customers, orders, staff management or writes.
- [ ] Owner A signs out and signs back in. Check normal restoration and correct cleanup.
- [ ] For a new test organization, start onboarding, refresh/switch modules and verify its draft
      survives. Finish once; a repeated completion must not create a duplicate restaurant.

## Set expectations honestly

This demo records unpaid orders; it does not process online payments. POS modifier selection,
customer loyalty redemption/reviews, DOB consent collection, subscription purchases, CSV export,
operating-hours editing and administrator account provisioning are incomplete. A phone number
is unverified. Preparation times appear only when the restaurant supplies them; otherwise ask
staff for an estimate. Analytics covers the selected location's loaded orders.

The automated browser run uses fixtures. Keep this checklist unchecked until the managed
staging/device workflow is actually performed. Production rollout requires separate approval.
