# Bills and printable receipts

POS → **Bills & recorded payments** opens billing for the selected location. Cashier duty plus
active location assignment is required; owners/admins/managers retain their authorized access.
Review table/customer, item quantities, modifiers and server totals before recording settlement.

Select a single order or combine orders in one table session. Server locks and unique order
links prevent double billing. Owners/admins/managers may request a currency-amount discount with
a reason. Cashiers cannot authorize discounts. Tax/service amounts use the existing order's
configured basis, proportionally reduced and rounded for the authorized discount; no GST rate
is hardcoded. Currency and all payable totals come from the database.

Issued bills freeze branding, address/contact, GSTIN if configured, order/table identifiers,
item amounts/modifiers, discounts, taxes, service charges, total, issuance time and receipt
number. Reprints retrieve current recorded payment status while preserving the bill snapshot.
Receipt numbers use a locked per-location/calendar-year counter and a unique location series.
An already-issued order opens its immutable bill; changing its discount requires an eligible
void/reissue, not silently editing the issued record.

Printing opens a dedicated document with escaped text, 58 mm, 80 mm or A4 layout, and browser
Print / save PDF fallback. Thermal page height is measured from the rendered receipt. Configure
the OS/driver paper and margins and physically verify output. A browser test does not certify a
particular thermal printer, paper cutter, long-roll pagination or network-printer protocol.

These documents are explicitly labelled **Receipt — not a verified tax invoice**. GSTIN syntax
does not prove registration or tax treatment. The current aggregate tax model does not implement
per-item GST/HSN/SAC, CGST/SGST/IGST breakdown, fiscal-year GST invoice series, credit notes or
e-invoicing. A registered restaurant must use an appropriately reviewed invoicing process.
Do not relabel these receipts as tax invoices. [CBIC Rule 46](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001)
sets separate tax-invoice particulars and numbering requirements; qualified tax review is needed.

Only an authorized manager/owner can void an unpaid bill with no ledger history and a reason.
Its number/audit remain; its orders may be billed again or cancelled. Bills with payment history
require reconciliation/refunds, not deletion. Full recorded payment and served status are both
required before the cashier completes the bill's orders. Completion is checked server-side.

Legacy orders already marked paid without ledger entries are not turned into fabricated new
payments. Reconcile those separately before generating a V3.1 bill. Takeaway POS creation,
editing accepted order items, split-tender allocation across separate invoices and legally
verified tax invoicing remain outside this release's completed workflows.
