# V3.1 changed files

Compared with verified V3 commit `4b958cadd0a9469c7c15f3bf1f74b21d479f327b`.

59 files; generated build output, caches, env files, screenshots and traces are excluded.

## Application

- [src/App.tsx](../src/App.tsx)
- [src/components/admin/AdminUsersView.tsx](../src/components/admin/AdminUsersView.tsx)
- [src/components/admin/PlatformAdminView.tsx](../src/components/admin/PlatformAdminView.tsx)
- [src/components/admin/ProvisionForm.tsx](../src/components/admin/ProvisionForm.tsx)
- [src/components/admin/StaffDutyEditor.tsx](../src/components/admin/StaffDutyEditor.tsx)
- [src/components/analytics/AnalyticsView.tsx](../src/components/analytics/AnalyticsView.tsx)
- [src/components/analytics/FinancialOverview.tsx](../src/components/analytics/FinancialOverview.tsx)
- [src/components/auth/OperatorGate.tsx](../src/components/auth/OperatorGate.tsx)
- [src/components/auth/StaffAuthGate.tsx](../src/components/auth/StaffAuthGate.tsx)
- [src/components/billing/BillingView.tsx](../src/components/billing/BillingView.tsx)
- [src/components/billing/InvoiceSettings.tsx](../src/components/billing/InvoiceSettings.tsx)
- [src/components/billing/PrintDocument.tsx](../src/components/billing/PrintDocument.tsx)
- [src/components/customer/CheckoutDrawer.tsx](../src/components/customer/CheckoutDrawer.tsx)
- [src/components/customer/CustomerView.tsx](../src/components/customer/CustomerView.tsx)
- [src/components/kds/KitchenView.tsx](../src/components/kds/KitchenView.tsx)
- [src/components/layout/Navbar.tsx](../src/components/layout/Navbar.tsx)
- [src/components/layout/NetworkStatus.tsx](../src/components/layout/NetworkStatus.tsx)
- [src/components/pos/POSView.tsx](../src/components/pos/POSView.tsx)
- [src/components/settings/BrandingSettings.tsx](../src/components/settings/BrandingSettings.tsx)
- [src/components/settings/SettingsView.tsx](../src/components/settings/SettingsView.tsx)
- [src/context/RestaurantContext.tsx](../src/context/RestaurantContext.tsx)
- [src/lib/branding.ts](../src/lib/branding.ts)
- [src/lib/hours.ts](../src/lib/hours.ts)
- [src/lib/mappers.ts](../src/lib/mappers.ts)
- [src/lib/pilot.ts](../src/lib/pilot.ts)
- [src/lib/route.ts](../src/lib/route.ts)
- [src/types/index.ts](../src/types/index.ts)
- [src/types/pilot.ts](../src/types/pilot.ts)

## Database and Edge Function

- [supabase/functions/_shared/pilot-handler.ts](../supabase/functions/_shared/pilot-handler.ts)
- [supabase/functions/pilot-admin/deno.json](../supabase/functions/pilot-admin/deno.json)
- [supabase/functions/pilot-admin/deno.lock](../supabase/functions/pilot-admin/deno.lock)
- [supabase/functions/pilot-admin/index.ts](../supabase/functions/pilot-admin/index.ts)
- [supabase/migrations/20261110170915_v31_trusted_onboarding.sql](../supabase/migrations/20261110170915_v31_trusted_onboarding.sql)
- [supabase/migrations/20261110170918_v31_billing_kot.sql](../supabase/migrations/20261110170918_v31_billing_kot.sql)
- [supabase/migrations/20261110174122_v31_operations.sql](../supabase/migrations/20261110174122_v31_operations.sql)

## Tests and test configuration

- [tests/browser/flows.spec.ts](../tests/browser/flows.spec.ts)
- [tests/fixtures/schema-before-v3.sql](../tests/fixtures/schema-before-v3.sql)
- [tests/pilot-admin.test.ts](../tests/pilot-admin.test.ts)
- [tests/pilot-client.test.tsx](../tests/pilot-client.test.tsx)
- [tests/pilot-database.test.ts](../tests/pilot-database.test.ts)
- [playwright.config.ts](../playwright.config.ts)

## Documentation

- [docs/OTP_FREE_ONBOARDING.md](../docs/OTP_FREE_ONBOARDING.md)
- [docs/RESTAURANT_DEMO_GUIDE.md](../docs/RESTAURANT_DEMO_GUIDE.md)
- [docs/SUPABASE_SECURITY.md](../docs/SUPABASE_SECURITY.md)
- [docs/TESTING.md](../docs/TESTING.md)
- [docs/V3_1_ARCHITECTURE.md](../docs/V3_1_ARCHITECTURE.md)
- [docs/V3_1_BASELINE.md](../docs/V3_1_BASELINE.md)
- [docs/V3_1_BILLING.md](../docs/V3_1_BILLING.md)
- [docs/V3_1_DATABASE_MIGRATIONS.md](../docs/V3_1_DATABASE_MIGRATIONS.md)
- [docs/V3_1_DEPLOYMENT.md](../docs/V3_1_DEPLOYMENT.md)
- [docs/V3_1_FILES.md](../docs/V3_1_FILES.md)
- [docs/V3_1_KOT.md](../docs/V3_1_KOT.md)
- [docs/V3_1_PAYMENT_RECONCILIATION.md](../docs/V3_1_PAYMENT_RECONCILIATION.md)
- [docs/V3_1_RESTAURANT_DEMO.md](../docs/V3_1_RESTAURANT_DEMO.md)
- [docs/V3_1_RESTAURANT_ONBOARDING.md](../docs/V3_1_RESTAURANT_ONBOARDING.md)
- [docs/V3_1_SECURITY_AUDIT.md](../docs/V3_1_SECURITY_AUDIT.md)
- [docs/V3_1_TESTING.md](../docs/V3_1_TESTING.md)
- [docs/V3_FOLLOWUP.md](../docs/V3_FOLLOWUP.md)

## Root configuration/documentation

- [README.md](../README.md)
- [playwright.config.ts](../playwright.config.ts)
