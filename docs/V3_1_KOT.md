# Kitchen Order Tickets

Accepting an order through the checked status RPC creates one persisted KOT with its table/order
number, quantities, modifier names, instructions and accepted timestamp. Database uniqueness on
the order prevents duplicate tickets during retries. The ticket's status follows order status;
invalid transitions remain rejected. Location access is required for reads and printing.

KDS → Print Kitchen Slip opens that order's dedicated 80 mm ticket, not the whole dashboard.
Reprints retain the ticket number and snapshot and add a request audit event. A historical
accepted order without a ticket can be snapshotted on its first authorized print using its
recorded accepted timestamp. Orders that were never accepted cannot produce an accepted KOT.

Browser printing / Save PDF is the initial fallback. No compatible hardware is assumed and no
printer SDK, raw ESC/POS spooler or background printing daemon is installed. Physically test
width, long modifiers, page breaks and cutter behavior before a pilot.

Existing order Realtime and polling still deliver new orders/status changes to KDS/POS and
tracking. Billed orders require an eligible void before cancellation; paid history requires
reconciliation. Accepted-order item editing is not implemented: follow the restaurant's reviewed
cancellation/reorder workflow rather than changing a frozen ticket silently. Managed Realtime,
disconnect/reconnect and multi-kitchen concurrency remain staging acceptance items.
