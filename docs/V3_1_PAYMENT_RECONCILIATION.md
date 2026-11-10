# Recorded payments and cashier reconciliation

This release records staff assertions of cash, direct merchant UPI, an existing card terminal
or another offline method. It does not transfer money, validate a UPI settlement, integrate a
gateway, verify webhooks, process a refund through a provider or settle SaaS subscriptions.
External methods require a reference. Confirm against the merchant's actual records.

## Ledger rules

- A bill's outstanding balance is its frozen total minus payment entries plus refunds/reversals.
  Partial payment is explicit; overpayment is rejected. Request UUIDs are bound to bill, amount,
  method, kind, original payment, reference and reason. Same-request retries return one result.
- Cashiers can record payments only at assigned locations. Owners/admins/managers authorize
  refunds/reversals against an original payment, with matching method, a bounded refundable
  amount and a reason. Direct table writes and another tenant's IDs are rejected.
- Failed or unconfirmed external payment attempts are not counted as received money. Correct a
  mistaken confirmed record with an authorized reversal. A dedicated failed-attempt/provider
  event workflow is planned, not simulated.
- Existing order payment enums use `pending` for partial collections. Billing documents expose
  the more precise pending/partially-paid/paid/refund history and numeric balance. Do not infer
  cash received solely from an order's requested payment method.

A recorded refund/reversal reduces net collections; it does not erase the frozen bill or issue
a legal credit note. Consequently the formula above can show a balance again. Resolve any
commercial reduction/cancellation of the underlying bill obligation through the restaurant's
reviewed accounting/credit-note process. An in-app credit-note/adjusted-receivable workflow is
not implemented, and these reports are not a substitute for statutory accounts.

## Daily close

Review **My cashier reconciliation** for a date in the location timezone. The report includes
only that cashier's actual ledger entries, grouped by method. Count cash physically, enter the
count and note, then confirm today's close. Expected cash is computed server-side; the variance
is retained. A repeated identical close returns the same record; changed details are rejected.
A closed cashier cannot post further entries that local day. Another authorized cashier must
handle later work. Shift reopen/multiple shifts within one day are planned.

Owner metrics separately report order value by order date, issued bills by issuance date and
collections/returns by ledger date. Current outstanding is across all issued bills. Therefore
those figures are not expected to match when orders, discounts or payments cross dates.
Cross-check UPI/card references with merchant statements, review refunds, investigate cash
variance and retain the immutable bill/payment/audit history according to a reviewed policy.
