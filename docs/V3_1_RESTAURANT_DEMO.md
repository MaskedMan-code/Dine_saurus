# V3.1 restaurant acceptance run

Run in approved staging with synthetic restaurant/customer details. This is an acceptance
checklist, not a claim that managed Supabase or physical equipment has already passed.

1. Bootstrap a verified platform administrator. Deny a regular owner at `?view=platform_admin`.
   Provision Restaurant A/owner; retry the same request and inspect one completed operation.
   Deliver the one-time credential through the selected approved secure channel.
2. Sign in as owner with email/password. Confirm temporary credentials cannot bypass the SQL
   gate through direct requests. Set a different password, sign in afresh, complete restaurant/
   location/area/table setup and reject duplicate setup. Test an expired credential/reset.
3. Add cashier and kitchen accounts with their own credentials and assigned locations. Activate
   them. Change duties/assignments, deactivate access, and verify stale sessions cannot write.
   Deny self-promotion, cross-location IDs, shared-account reset and platform-role escalation.
4. Configure real branding, contact, timezone, receipt details and legally reviewed tax/service
   settings. Test declared closure/holidays, then restore a schedule appropriate for the demo.
   Verify the mobile customer menu displays the actual restaurant/table/description/branding.
5. Scan/download/decode the saved QR on another device. Add items/modifiers, enter an unverified
   operational name/mobile and place an order without an account or OTP. Refresh tracking.
6. Change menu name/price/stock from staff. Confirm the open guest menu/cart reconciles without
   discarding diner input. Remove an unavailable item. Disconnect/reconnect and retry uncertain
   orders; verify one database order and an honest offline status.
7. Receive the order in POS/KDS, accept it, inspect one KOT, print/reprint modifiers/instructions,
   then prepare, ready and serve. Reject invalid transitions. Check customer progress.
8. Cashier opens the correct table/customer order(s), generates the server bill and reviews items,
   tax/service and total. Deny a cashier discount; allow an authorized reasoned manager discount.
   Combine only orders sharing a table session.
9. Record partial cash and a referenced merchant UPI/card-terminal balance. Test duplicate clicks,
   lost responses and overpayment. Verify one ledger result per request; no gateway transfer is
   implied. Complete served/paid orders; verify the table/session and next visit behave correctly.
10. Print 58 mm, 80 mm and A4 receipts on actual drivers. Check all lines, wrapping, addresses,
    numbers, totals/status and reprints. Confirm they are receipts, not verified tax invoices.
11. Deny a cashier refund and another tenant's bill. Record an authorized reasoned refund/reversal
    against the original payment; reconcile it against actual merchant/cash records. Void only
    eligible unpaid bills. Never delete ledger history.
12. Review daily ordered/billed/collected metrics and honest empty timing history. Reconcile the
    cashier's own entries, count cash, close once and reject further same-day entries. Change
    locations and verify financial/reporting isolation and local date boundaries.
13. Create Restaurant B and test direct cross-tenant reads/writes, guessed object IDs, inactive
    employees, expired tracking and revoked QR tokens. Suspend/expire an account and verify
    server restrictions, then reactivate through authorized platform controls.
14. Complete the privacy/tax/retention review, backup restore drill, advisor review, incident runbook
    and independent concurrent-client tests. Record actual physical device/printer/operator
    sign-off before approving production. Planned features must remain labelled as planned.
