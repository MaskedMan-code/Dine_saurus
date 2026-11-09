# V3 repairs and file map

## Authentication and tenancy

- `src/context/AuthContext.tsx`: synchronous auth event callback, session race/version checks,
  cancellation, independent authorization loading/errors, correct logout and retry. Token
  refresh does not trigger a membership fetch.
- `src/lib/authMembership.ts`: deterministic multi-membership selection: active access first,
  then a validated remembered preference, role order owner/admin/manager/staff, then organization
  ID. Role comes from membership; activation comes from membership and employee status.
- `src/context/TenantContext.tsx`, `src/lib/route.ts`: explicit customer/staff route identity,
  QR-first public resolution, fail-closed invalid tokens, slug browsing, validated staff
  restaurant/location selection and stale-request cancellation.
- `src/components/auth/*`: guest browsing no longer requires Auth; operators use email/password.
  Missing profiles and inactive/pending access remain distinct from a signed-out session.

## Data, ordering and persistence

- `src/context/RestaurantContext.tsx`: tenant/location/table privacy boundaries; initial versus
  background catalog loading; scoped order/service queries, one stable Realtime channel,
  fallback polling and cleanup. Checked writes reconcile from returned rows. Mutations report
  errors without replacing the whole application.
- `src/lib/tables.ts`: one QR token, persisted-record readback, compensation on failed QR creation.
  Existing active QR tokens survive table edits.
- `src/lib/ordering.ts`: contact validation, persistent idempotency intent, uncertainty handling,
  deliberate repeat-order identity and expiring restaurant-scoped tracking receipts.
- `src/lib/money.ts`: common independent tax/service rounding with no hidden default tip.
- `src/lib/storage.ts`: storage failures/corrupt JSON do not crash initialization.
- `src/lib/placeholder.ts`: neutral missing-photo artwork, without inventing a dish photo.
- `src/components/customer/CheckoutDrawer.tsx`: visible server errors, retry, submit lock,
  mandatory name/mobile, preserved cart/contact draft, success only after confirmation.
- `src/components/customer/OrderTrackerModal.tsx`: honest preparation/status information;
  restoration is handled by the provider. Removed the moving tracker button after a browser
  actionability failure.
- `src/components/customer/ItemCustomizerModal.tsx`: reset choices when opening another item;
  required group selections must be satisfied before adding.
- `src/components/customer/TableSelectorModal.tsx`: changing a visual table no longer disagrees
  with the token sent to the server; diners scan the QR on their actual table.
- `src/components/customer/ServiceRequestModal.tsx`, `ReviewModal.tsx`: await confirmation,
  prevent repeated submission, show errors, and clean up success timers.

## Staff modules and honest UI

- `src/components/pos/POSView.tsx`: own item payload, selected table, contact validation,
  duplicate protection, failure feedback and honest payment-preference labels.
- `src/components/tables/TablesFloorView.tsx`: exact saved token in downloads/test links,
  generated-image failure feedback, checked save/delete, location-scoped floor data and stable
  form hooks. The displayed table code is derived from the persisted display name; the legacy unsupported `billed` option is disabled.
- `src/components/menu/MenuAdminView.tsx`: checked async saves/category creation and form locks;
  dialogs stay open when writes fail. Its hooks also run consistently.
- `src/components/admin/AdminUsersView.tsx`: atomic role/status RPC, cancellation/version checks,
  useful errors and horizontally scrollable user tables.
- `src/components/settings/SettingsView.tsx`: actual atomic brand/location/tax saves; no fake
  success for billing upgrades or unsupported currency/hours editing.
- `src/components/loyalty/LoyaltyAdminView.tsx`: real tenant customer visit records and recorded
  points, rather than a sample roster. Guest ownership-sensitive rewards remain guarded.
- `src/components/analytics/AnalyticsView.tsx`: loaded-order revenue/items and measured shares;
  unmeasured metrics are explicitly identified.
- `src/components/customer/CustomerView.tsx`, `LoyaltyDrawer.tsx`, `src/lib/mappers.ts`:
  fixed hooks, honest restaurant/table/review/estimate claims and guest privacy messages.
- `src/App.tsx`, `Navbar.tsx`: initial loading gates, background/error notices, preserved route
  selection, guest-specific chrome and an accessible account control.

## Configuration, SQL and tests

- `src/lib/diagnostics.ts`, `src/main.tsx`: opt-in document navigation, visibility, HMR,
  auth, provider and Realtime diagnostics. No customer data/tokens are logged.
- `src/lib/useSupabaseConnection.ts`: guarded connection checks and interval cleanup.
- `src/lib/supabase.ts`, `src/vite-env.d.ts`, `vite.config.ts`, `.env.example`: public-key support,
  secret-key build guard and ignored generated folders; StrictMode, token refresh and Realtime
  remain enabled.
- `supabase/migrations/20261109125008_v3_stabilization.sql`: review-only security/ordering/RLS,
  staff/settings transactions and publication repair. See security documentation for the
  changed guest-phone uniqueness contract and rollback constraints.
- `tests/fixtures/*`: schema-only live-shape snapshot with synthetic Auth helpers, roles and
  trigger fixtures for local tests. These are not production migrations.
- `tests/*.test.*`, `tests/browser/flows.spec.ts`, `vitest.config.ts`, `playwright.config.ts`,
  `eslint.config.js`: actual auth, checkout, QR, privacy, idempotency, tracking, SQL and browser
  regressions; TypeScript and React hook linting.
- `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`: canonical npm setup,
  strict source/test scope, patched dependencies, safe clean script and generated-file exclusion.

The 92 numbered copies and obsolete Bun lock were removed after comparison. The original
historical SQL was retained. Required audit, test, security, provisioning and demo documents
replace earlier unverified claims. No production SQL was applied.
