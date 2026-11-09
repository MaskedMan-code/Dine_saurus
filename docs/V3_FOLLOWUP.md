# Manual-test follow-up

## Frontend repairs

- `src/lib/menuStock.ts` and `src/context/RestaurantContext.tsx`: Edit Item and the quick stock
  action write the same location-specific `sold_out` setting and reconcile the returned row.
  Stock-only edits preserve location availability, price overrides, the base price and global
  publication status. A failed stock write keeps the editor open with an error. Existing item
  details may already have saved; a refresh reconciles them before retry. New items remain
  unpublished until stock is saved, with cleanup if that step fails.
- `src/lib/mappers.ts` and `src/types/index.ts`: keep base price and publication status separate
  from effective location price/availability.
- `src/lib/useCatalogRefresh.ts` and the restaurant provider: public QR menus listen for scoped
  catalog changes, coalesce refreshes and queue one reconciliation during an in-flight load.
  Reconnect/visibility refresh and a visible-page 15-second fallback cover missing events,
  unpublishing/deletion and modifier changes. Background refresh preserves the cart and diner
  inputs, updates displayed cart prices/stock, and removes unpublished items from the menu.
- `src/components/customer/CheckoutDrawer.tsx`: a bounded dialog has a dedicated shrinking
  scroll region, fixed header/footer, touch scrolling and a restored body scroll lock.
  Checkout remains pay-at-restaurant; no online payment is collected.
- A service-request permission failure now identifies the required database update. Checkout
  still reports an unavailable RPC honestly, preserves the cart/retry intent and never falls
  back to the non-idempotent legacy function.

## Database findings and prepared correction

Read-only inspection confirmed the reported live state: `current_customer_id()` is executable
only by the owner/service role, while legacy service-request policies call it; the new ordering
RPC is absent. No production SQL, policies, grants or publication entries were changed.

The original migration already defines `place_qr_order_idempotent` with server validation,
private idempotency receipts and anonymous/authenticated EXECUTE. Deploy that complete reviewed
migration rather than adding a wrapper around unsafe legacy ordering.

The new follow-up SQL makes the helper caller-bound with an empty search path and authenticated
EXECUTE, removes the known legacy service-request policies, retains scoped reads/updates, adds
catalog publication entries under existing RLS, checks the ordering RPC prerequisite, grants
its intended browser access and requests a PostgREST schema-cache reload. It is transactional
and tested for reapplication against the inspected schema.

## Remaining deployment steps

1. Review and back up the target schema, grants, policies and data. Apply these files to an
   isolated staging database in order:
   - `supabase/migrations/20261109125008_v3_stabilization.sql`
   - `supabase/migrations/20261109191729_v3_menu_refresh_permissions.sql`
2. Verify Data API RPC discovery/signature and anon/authenticated grants; test guest order
   creation, same-intent retries, service refresh as assigned staff and denial across tenants.
   Confirm catalog publication/RLS delivery across separate devices, reconnection and polling.
3. Complete the managed staging checks in [TESTING.md](TESTING.md), including independent
   concurrent clients. Local SQL and mocked browser tests cannot verify managed service delivery.
4. Obtain explicit production approval before applying either migration. Coordinate the database
   and compatible frontend rollout, then repeat the acceptance checks and security advisors.

Production guest ordering and service-request refresh remain blocked by the undeployed SQL.
No merge to `main` is part of this work. See [SUPABASE_SECURITY.md](SUPABASE_SECURITY.md) for the
full rollout and rollback procedure and [TESTING.md](TESTING.md) for results and limitations.
