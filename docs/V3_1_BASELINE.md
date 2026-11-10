# V3.1 baseline — 10 November 2026

Verified starting commit: `4b958cadd0a9469c7c15f3bf1f74b21d479f327b`, on local/remote
`fix/v3-stabilization`. Remote `main` remains `fa45b0f`. The working tree was clean; no newer
remote stabilization commit existed after fetch. New work uses `feature/v3.1-commercial-pilot`.
The verified baseline is tagged `v3-verified-baseline-20261110`.

Actual baseline results: clean `npm.cmd ci` (325 packages; zero vulnerabilities), lint passed,
53 tests in six files passed, production build passed (711.01 kB bundle warning), all 26
desktop/mobile browser tests passed in 54.5 seconds. No baseline test failures occurred.
PowerShell blocks `npm.ps1`; commands use the equivalent `npm.cmd`.

Read-only live inspection confirms migrations named `v3_stabilization` and
`v3_menu_refresh_permissions` were deployed externally (versions `20261109213730` and
`20261109213739`). Their remote timestamps differ from the reviewed local filenames. The exact
ordering RPC signature exists with anon execution; the customer helper allows authenticated
execution and denies anon; service policies are the two reviewed V3 policies; all nine expected
Realtime tables are published. Auth users have corresponding profiles. No real account/order
write or test was performed. Deployment history and grants do not constitute end-to-end sign-off.

Advisor baseline: five intentional anonymous definer endpoints, thirteen authenticated definer
endpoints, leaked-password protection disabled, two private deny-by-default tables without
policies; performance findings include two unindexed foreign keys, two auth initplans, 31
overlapping policy findings and 48 unused indexes. These require specific review, not blanket
revocation or deletion. Live browser roles also retain dangerous TRUNCATE privileges on several
protected tables, which bypass RLS and require explicit revocation in V3.1.

The installed CLI remains 2.122.1; current CLI v3's changed defaults do not apply. No dependency
upgrade, live migration, payment-provider activation, production Auth setting change or merge
was performed by this work.
