// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID as uuid } from 'node:crypto';
import { beforeAll, afterAll, expect, test } from 'vitest';
let db: PGlite;
const platform = uuid(),
  owner = uuid(),
  outsider = uuid(),
  cashier = uuid(),
  kitchen = uuid();
const org = uuid(),
  otherOrg = uuid(),
  restaurant = uuid(),
  location = uuid(),
  otherLocation = uuid(),
  table = uuid(),
  item = uuid();
const token = 'qr_' + uuid();
const migrations = [
  '20261109125008_v3_stabilization.sql',
  '20261109191729_v3_menu_refresh_permissions.sql',
  '20261110170915_v31_trusted_onboarding.sql',
  '20261110170918_v31_billing_kot.sql',
  '20261110174122_v31_operations.sql',
];
async function as<T>(
  role: string,
  user: string | null,
  run: () => Promise<T>,
  iat = Math.floor(Date.now() / 1000) + 2,
): Promise<T> {
  await db.exec('set role ' + role);
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [user || '', JSON.stringify({ sub: user, iat })],
  );
  try {
    return await run();
  } finally {
    await db.exec('reset role');
    await db.exec(
      "select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false)",
    );
  }
}
async function rpc(name: string, args: unknown[] = []) {
  return (
    await db.query<any>(
      'select public.' + name + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ') as value',
      args,
    )
  ).rows[0].value;
}
async function order(qrToken = token) {
  return as(
    'anon',
    null,
    async () =>
      (
        await rpc('place_qr_order_idempotent', [
          qrToken,
          JSON.stringify([{ menu_item_id: item, quantity: 2, modifiers: [] }]),
          'Synthetic Diner',
          '+919000000001',
          uuid(),
          'cash',
          0,
          null,
          'dine_in',
          null,
          null,
          226,
        ])
      ).order,
  );
}
async function bill(orderIds: string[], discount = 0, reason: string | null = null, key = uuid()) {
  return rpc('pilot_issue_bill', [orderIds, discount, reason, key]);
}
async function payment(
  b: string,
  amount: number,
  kind = 'payment',
  original: string | null = null,
  method = 'cash',
  reference: string | null = null,
  reason: string | null = null,
  key = uuid(),
) {
  return rpc('pilot_record_payment', [b, amount, method, kind, original, reference, reason, key]);
}
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(
    'set check_function_bodies=off;' + readFileSync('tests/fixtures/schema-before-v3.sql', 'utf8'),
  );
  await db.exec(readFileSync('tests/fixtures/triggers-before-v3.sql', 'utf8'));
  await db.exec('create publication supabase_realtime;');
  for (const file of migrations) await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
  for (const [id, email] of [
    [platform, 'platform'],
    [owner, 'owner'],
    [outsider, 'outsider'],
    [cashier, 'cashier'],
    [kitchen, 'kitchen'],
  ])
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, email + '@example.test']);
  await db.query('insert into private.platform_administrators(user_id) values($1)', [platform]);
  for (const [id, name] of [
    [org, 'A'],
    [otherOrg, 'B'],
  ])
    await db.query(
      "insert into public.organizations(id,name,country_code,default_currency,default_timezone) values($1,$2,'IN','INR','Asia/Kolkata')",
      [id, name],
    );
  for (const [user, organization, role, duty] of [
    [owner, org, 'owner', 'manager'],
    [outsider, otherOrg, 'owner', 'manager'],
    [cashier, org, 'staff', 'cashier'],
    [kitchen, org, 'staff', 'kitchen'],
  ]) {
    const m = (
      await db.query<any>(
        'insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3) returning id',
        [organization, user, role],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.staff_members(organization_id,user_id,status) values($1,$2,'active')",
      [organization, user],
    );
    await db.query('insert into public.pilot_staff_duties(member_id,duty) values($1,$2)', [
      m,
      duty,
    ]);
  }
  await db.query(
    "insert into public.restaurants(id,organization_id,name,slug,status,tax_rate_percent,service_charge_percent) values($1,$2,'Test Restaurant','pilot-a','active',8,5)",
    [restaurant, org],
  );
  await db.query(
    "insert into public.restaurant_locations(id,organization_id,restaurant_id,name,country_code,timezone,currency) values($1,$2,$3,'Main','IN','Asia/Kolkata','INR')",
    [location, org, restaurant],
  );
  const r2 = uuid();
  await db.query(
    "insert into public.restaurants(id,organization_id,name,slug,status) values($1,$2,'Other','pilot-b','active')",
    [r2, otherOrg],
  );
  await db.query(
    "insert into public.restaurant_locations(id,organization_id,restaurant_id,name,country_code,timezone,currency) values($1,$2,$3,'Other','IN','Asia/Kolkata','INR')",
    [otherLocation, otherOrg, r2],
  );
  const role = (
    await db.query<any>(
      "insert into public.roles(organization_id,name) values($1,'Test role') returning id",
      [org],
    )
  ).rows[0].id;
  await db.query(
    'insert into public.staff_location_assignments(staff_member_id,location_id,role_id) select id,$1,$2 from public.staff_members where user_id in ($3,$4)',
    [location, role, cashier, kitchen],
  );
  await db.query(
    "insert into public.restaurant_tables(id,location_id,display_name,capacity) values($1,$2,'Table 1',4)",
    [table, location],
  );
  await db.query('insert into public.table_qr_codes(table_id,public_token) values($1,$2)', [
    table,
    token,
  ]);
  const category = (
    await db.query<any>(
      "insert into public.menu_categories(restaurant_id,name) values($1,'Mains') returning id",
      [restaurant],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.menu_items(id,restaurant_id,category_id,name,base_price,currency) values($1,$2,$3,'Test Soup',100,'INR')",
    [item, restaurant, category],
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});

test('server financial metrics distinguish ordered value, issued bills and recorded collections with honest empty history', async () => {
  const empty = await as('authenticated', outsider, () =>
    rpc('pilot_daily_metrics', [otherLocation, '2000-01-01']),
  );
  expect(empty.orders.count).toBe(0);
  expect(empty.collections.received).toBe(0);
  expect(empty.timing.preparation_minutes).toBeNull();
  expect(empty.items).toEqual([]);
  await as('authenticated', outsider, async () => {
    await expect(rpc('pilot_daily_metrics', [location, '2000-01-01'])).rejects.toThrow(
      /reporting access/,
    );
  });
});

test('V3.1 migrations reapply without losing existing data and browser roles cannot truncate protected tables', async () => {
  for (const file of migrations.slice(2))
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
  for (const tableName of [
    'organization_members',
    'staff_members',
    'staff_location_assignments',
    'audit_logs',
    'subscriptions',
    'orders',
  ]) {
    expect(
      (
        await db.query<any>(
          "select has_table_privilege('authenticated',$1,'truncate') as allowed",
          ['public.' + tableName],
        )
      ).rows[0].allowed,
    ).toBe(false);
  }
  await as('authenticated', owner, async () => {
    await expect(db.query('delete from public.audit_logs')).rejects.toThrow(/permission denied/);
    await expect(
      db.query('insert into private.platform_administrators(user_id) values($1)', [owner]),
    ).rejects.toThrow(/permission denied/);
  });
});
test('only a verified platform administrator can provision an owner; browser RPC bypass fails', async () => {
  const payload = {
    organization_name: 'Provisioned Restaurant',
    country_code: 'IN',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    email: 'new-owner@example.test',
    display_name: 'New Owner',
    email_verified: true,
  };
  await as('authenticated', owner, async () => {
    await expect(
      rpc('pilot_prepare_provision', [
        owner,
        9999999999,
        uuid(),
        'restaurant',
        JSON.stringify(payload),
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(rpc('pilot_platform_overview')).rejects.toThrow(/Platform administrator/);
  });
  await as('service_role', null, async () => {
    await expect(
      rpc('pilot_prepare_provision', [
        owner,
        9999999999,
        uuid(),
        'restaurant',
        JSON.stringify(payload),
      ]),
    ).rejects.toThrow(/access denied/);
  });
  const request = uuid(),
    user = uuid();
  const prepared = await as('service_role', null, () =>
    rpc('pilot_prepare_provision', [
      platform,
      9999999999,
      request,
      'restaurant',
      JSON.stringify(payload),
    ]),
  );
  await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [
    user,
    payload.email,
    JSON.stringify({ pilot_provisioning_id: request }),
  ]);
  // Simulate an unknown Auth response: the same request recovers only its own trusted marker.
  expect(
    (
      await as('service_role', null, () =>
        rpc('pilot_prepare_provision', [
          platform,
          9999999999,
          request,
          'restaurant',
          JSON.stringify(payload),
        ]),
      )
    ).target_user_id,
  ).toBe(user);
  const complete = await as('service_role', null, () =>
    rpc('pilot_finish_provision', [platform, 9999999999, request, user]),
  );
  expect(complete.organization_id).toBe(prepared.organization_id);
  expect(
    await as('service_role', null, () =>
      rpc('pilot_finish_provision', [platform, 9999999999, request, user]),
    ),
  ).toEqual(complete);
  await as('service_role', null, async () => {
    await expect(
      rpc('pilot_prepare_provision', [
        platform,
        9999999999,
        request,
        'restaurant',
        JSON.stringify({ ...payload, organization_name: 'Changed' }),
      ]),
    ).rejects.toThrow(/different details/);
  });
  await as('authenticated', user, async () => {
    expect((await rpc('pilot_operator_gate')).must_change).toBe(true);
    await expect(
      rpc('create_restaurant_onboarding', [
        complete.organization_id,
        'New',
        'cafe',
        'Main',
        'Address',
        'City',
        '123456',
        'State',
        'IN',
        'INR',
        'Asia/Kolkata',
        null,
        null,
        null,
        'Dining',
        '[]',
      ]),
    ).rejects.toThrow(/access|admin/i);
    await expect(rpc('pilot_complete_password_change', [user])).rejects.toThrow(
      /permission denied/,
    );
  });
  await as('service_role', null, async () => {
    await expect(rpc('pilot_complete_password_change', [user])).rejects.toThrow(
      /not been confirmed/,
    );
  });
  await db.query("update auth.users set encrypted_password='new-synthetic-hash' where id=$1", [
    user,
  ]);
  // A direct Auth update does not clear the server gate.
  expect((await as('authenticated', user, () => rpc('pilot_operator_gate'))).must_change).toBe(
    true,
  );
  await as('service_role', null, () => rpc('pilot_complete_password_change', [user]));
  expect((await as('authenticated', user, () => rpc('pilot_operator_gate'), 0)).ready).toBe(false);
  expect((await as('authenticated', user, () => rpc('pilot_operator_gate'))).ready).toBe(true);
  const setupArgs = [
    complete.organization_id,
    'New Restaurant',
    'cafe',
    'Main',
    'Test Address',
    'Test City',
    '123456',
    'Test State',
    'IN',
    'INR',
    'Asia/Kolkata',
    null,
    null,
    null,
    'Dining',
    JSON.stringify([{ name: 'Table 1', capacity: 4 }]),
  ];
  const setup = await as('authenticated', user, () =>
    rpc('create_restaurant_onboarding', setupArgs),
  );
  expect(setup.table_count).toBe(1);
  expect(
    (
      await db.query<any>('select tax_rate_percent from public.restaurants where id=$1', [
        setup.restaurant_id,
      ])
    ).rows[0].tax_rate_percent,
  ).toBe('0.000');
  await as('authenticated', user, async () => {
    await expect(rpc('create_restaurant_onboarding', setupArgs)).rejects.toThrow(/already/i);
  });
  expect(
    (await db.query('select id from public.organization_members where user_id=$1', [user])).rows,
  ).toHaveLength(1);
});
test('owner staff provisioning validates locations, duties and expiration; deactivation revokes direct RPC access', async () => {
  const payload = {
    organization_id: org,
    email: 'new-staff@example.test',
    display_name: 'New Cashier',
    email_verified: true,
    duty: 'cashier',
    location_ids: [location],
  };
  await as('service_role', null, async () => {
    await expect(
      rpc('pilot_prepare_provision', [
        owner,
        9999999999,
        uuid(),
        'staff',
        JSON.stringify({ ...payload, location_ids: [otherLocation] }),
      ]),
    ).rejects.toThrow(/another organization/);
    await expect(
      rpc('pilot_prepare_provision', [
        owner,
        9999999999,
        uuid(),
        'staff',
        JSON.stringify({ ...payload, duty: 'owner' }),
      ]),
    ).rejects.toThrow(/Invalid staff duty/);
  });
  const key = uuid(),
    user = uuid();
  await as('service_role', null, () =>
    rpc('pilot_prepare_provision', [owner, 9999999999, key, 'staff', JSON.stringify(payload)]),
  );
  await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [
    user,
    payload.email,
    JSON.stringify({ pilot_provisioning_id: key }),
  ]);
  await as('service_role', null, () =>
    rpc('pilot_finish_provision', [owner, 9999999999, key, user]),
  );
  await db.query(
    "update private.operator_credentials set expires_at=now()-interval '1 hour' where user_id=$1",
    [user],
  );
  await as('service_role', null, async () => {
    await expect(rpc('pilot_complete_password_change', [user])).rejects.toThrow(/expired/);
  });
  const m = (
    await db.query<any>('select id from public.organization_members where user_id=$1', [cashier])
  ).rows[0].id;
  await as('authenticated', owner, () => rpc('set_staff_access', [m, 'staff', false]));
  await as('authenticated', cashier, async () => {
    await expect(rpc('pilot_issue_bill', [[uuid()], 0, null, uuid()])).rejects.toThrow(
      /not found|access/i,
    );
    expect((await db.query('select id from public.orders')).rows).toHaveLength(0);
  });
  await as('authenticated', owner, () => rpc('set_staff_access', [m, 'staff', true]));
});
test('account restrictions and user/location limits are enforced server-side while public browsing survives', async () => {
  await as('authenticated', owner, async () => {
    await expect(
      rpc('pilot_set_account', [org, 'active', null, 1, 10, true, true]),
    ).rejects.toThrow(/Platform administrator/);
  });
  await as('authenticated', platform, () =>
    rpc('pilot_set_account', [org, 'suspended', null, 1, 10, true, true]),
  );
  await expect(order()).rejects.toThrow(/not accepting/);
  await as('authenticated', owner, async () => {
    expect((await db.query('select id from public.orders')).rows).toHaveLength(0);
  });
  await as('authenticated', platform, () =>
    rpc('pilot_set_account', [org, 'active', null, 1, 10, true, true]),
  );
  await expect(
    db.query(
      "insert into public.restaurant_locations(organization_id,restaurant_id,name,country_code,timezone,currency) values($1,$2,'Extra','IN','Asia/Kolkata','INR')",
      [org, restaurant],
    ),
  ).rejects.toThrow(/Location limit/);
  await as('anon', null, async () => {
    expect((await db.query('select id from public.menu_items')).rows.length).toBeGreaterThan(0);
  });
});
test('restaurant owners cannot reset a shared or platform identity, assign cross-tenant locations, or escalate to platform admin', async () => {
  const shared = uuid();
  await db.query("insert into auth.users(id,email) values($1,'shared@example.test')", [shared]);
  const member = (
    await db.query<any>(
      "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'staff') returning id",
      [org, shared],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",
    [otherOrg, shared],
  );
  await as('service_role', null, async () => {
    await expect(
      rpc('pilot_prepare_provision', [
        owner,
        9999999999,
        uuid(),
        'reset',
        JSON.stringify({ organization_id: org, member_id: member }),
      ]),
    ).rejects.toThrow(/Shared or platform/);
  });
  const cashierMember = (
    await db.query<any>(
      'select id from public.organization_members where organization_id=$1 and user_id=$2',
      [org, cashier],
    )
  ).rows[0].id;
  await as('authenticated', owner, async () => {
    await expect(
      rpc('pilot_set_staff_duty', [cashierMember, 'cashier', [otherLocation]]),
    ).rejects.toThrow(/same-organization/);
    await rpc('pilot_set_staff_duty', [cashierMember, 'cashier', [location]]);
  });
  await as('authenticated', cashier, async () => {
    await expect(rpc('set_staff_access', [cashierMember, 'owner', true])).rejects.toThrow(
      /Administrator/,
    );
    await expect(rpc('pilot_platform_overview')).rejects.toThrow(/Platform administrator/);
  });
});
test('billing uses server snapshots, sequential unique numbers and scoped retry-safe issuance', async () => {
  const a = await order(),
    b = await order();
  const key = uuid();
  const first = await as('authenticated', owner, () => bill([a.id], 20, 'Owner discount', key));
  expect(Number(first.total)).toBe(203.4);
  expect(first.snapshot.orders[0].items[0].name).toBe('Test Soup');
  expect((await as('authenticated', owner, () => bill([a.id], 20, 'Owner discount', key))).id).toBe(
    first.id,
  );
  await as('authenticated', owner, async () => {
    await expect(bill([a.id], 21, 'Owner discount', key)).rejects.toThrow(/different details/);
  });
  const second = await as('authenticated', cashier, () => bill([b.id]));
  expect(
    Number(second.receipt_number.split('-').at(-1)) -
      Number(first.receipt_number.split('-').at(-1)),
  ).toBe(1);
  await as('authenticated', outsider, async () => {
    await expect(rpc('pilot_get_bill', [first.id])).rejects.toThrow(/access denied/);
    expect((await db.query('select id from public.pilot_bills')).rows).toHaveLength(0);
  });
  await as('authenticated', kitchen, async () => {
    await expect(rpc('pilot_get_bill', [first.id])).rejects.toThrow(/access denied/);
  });
  const c = await order();
  await as('authenticated', cashier, async () => {
    await expect(bill([c.id], 5, 'Cashier discount')).rejects.toThrow(/Authorized discount/);
  });
  const d = await order();
  const combined = await as('authenticated', owner, () => bill([c.id, d.id]));
  expect(Number(combined.total)).toBe(452);
  expect(combined.snapshot.orders).toHaveLength(2);
});
test('partial payments, duplicate retries, overpayment, external references and refunds are authoritative', async () => {
  const o = await order();
  const b = await as('authenticated', owner, () => bill([o.id]));
  const key = uuid();
  const partial = await as('authenticated', cashier, () =>
    payment(b.id, 100, 'payment', null, 'cash', null, null, key),
  );
  expect(partial.payment_status).toBe('partially_paid');
  expect(Number(partial.balance)).toBe(126);
  expect(
    (
      await as('authenticated', cashier, () =>
        payment(b.id, 100, 'payment', null, 'cash', null, null, key),
      )
    ).payments,
  ).toHaveLength(1);
  await as('authenticated', cashier, async () => {
    await expect(payment(b.id, 101, 'payment', null, 'cash', null, null, key)).rejects.toThrow(
      /different details/,
    );
    await expect(payment(b.id, 127)).rejects.toThrow(/exceeds/);
    await expect(payment(b.id, 126, 'payment', null, 'upi')).rejects.toThrow(/reference/);
  });
  const full = await as('authenticated', cashier, () =>
    payment(b.id, 126, 'payment', null, 'upi', 'UPI-TEST-123'),
  );
  expect(full.payment_status).toBe('paid');
  expect(Number(full.balance)).toBe(0);
  await as('authenticated', cashier, async () => {
    await expect(rpc('pilot_complete_bill', [b.id])).rejects.toThrow(/Serve all/);
  });
  await as('authenticated', kitchen, async () => {
    for (const status of ['accepted', 'preparing', 'ready', 'served'])
      await rpc('update_order_status_secure', [o.id, status, null]);
  });
  await as('authenticated', cashier, () => rpc('pilot_complete_bill', [b.id]));
  expect(
    (await db.query<any>('select status from public.orders where id=$1', [o.id])).rows[0].status,
  ).toBe('completed');
  const first = full.payments.find((p: any) => p.method === 'cash');
  await as('authenticated', cashier, async () => {
    await expect(
      payment(b.id, 10, 'refund', first.id, 'cash', null, 'Customer return'),
    ).rejects.toThrow(/access denied/);
  });
  const refunded = await as('authenticated', owner, () =>
    payment(b.id, 10, 'refund', first.id, 'cash', null, 'Customer return'),
  );
  expect(refunded.payment_status).toBe('partially_refunded');
  expect(Number(refunded.refunded)).toBe(10);
  await as('authenticated', owner, async () => {
    await expect(payment(b.id, 91, 'refund', first.id, 'cash', null, 'Too much')).rejects.toThrow(
      /refund amount/,
    );
    await expect(db.query('update public.pilot_payments set amount=999')).rejects.toThrow(
      /permission denied/,
    );
  });
});
test('KOT creation and reprint are idempotent and follow the checked order status lifecycle', async () => {
  const o = await order();
  await as('authenticated', kitchen, async () => {
    await expect(rpc('pilot_get_kot', [o.id])).rejects.toThrow(/Accept/);
    await rpc('update_order_status_secure', [o.id, 'accepted', null]);
    const kot = await rpc('pilot_get_kot', [o.id]);
    expect(kot.snapshot.items[0].quantity).toBe(2);
    await rpc('update_order_status_secure', [o.id, 'accepted', null]);
    await rpc('pilot_get_kot', [o.id]);
    expect(
      (await db.query('select order_id from public.pilot_kot_tickets where order_id=$1', [o.id]))
        .rows,
    ).toHaveLength(1);
    await expect(rpc('update_order_status_secure', [o.id, 'completed', null])).rejects.toThrow(
      /Invalid/,
    );
    await rpc('update_order_status_secure', [o.id, 'preparing', null]);
    expect((await rpc('pilot_get_kot', [o.id])).status).toBe('preparing');
  });
  await as('authenticated', outsider, async () => {
    await expect(rpc('pilot_get_kot', [o.id])).rejects.toThrow(/access denied/);
  });
});
test('billed cancellations require an authorized void, and unpaid orders cannot complete', async () => {
  const o = await order();
  const b = await as('authenticated', owner, () => bill([o.id]));
  await as('authenticated', owner, async () => {
    await expect(rpc('update_order_status_secure', [o.id, 'cancelled', null])).rejects.toThrow(
      /Void/,
    );
    await rpc('pilot_void_bill', [b.id, 'Mistaken order']);
    await rpc('update_order_status_secure', [o.id, 'cancelled', null]);
    expect((await rpc('pilot_get_bill', [b.id])).state).toBe('void');
  });
});
test('cashier closing reconciles only recorded money and prevents new entries after closing', async () => {
  const o = await order(),
    b = await as('authenticated', cashier, () => bill([o.id]));
  await as('authenticated', cashier, async () => {
    const day = (
      await db.query<any>("select (now() at time zone 'Asia/Kolkata')::date::text as day")
    ).rows[0].day;
    const summary = await rpc('pilot_cashier_summary', [location, day]);
    expect(summary.methods.find((m: any) => m.method === 'cash').net).toBe(100);
    const close = await rpc('pilot_close_cashier', [location, 100, 'Test close']);
    expect(Number(close.expected_cash)).toBe(100);
    expect((await rpc('pilot_close_cashier', [location, 100, 'Test close'])).id).toBe(close.id);
    await expect(payment(b.id, 226)).rejects.toThrow(/day is closed/);
  });
});
test('daily collection figures use the immutable payment ledger rather than ordered revenue', async () => {
  const day = (await db.query<any>("select (now() at time zone 'Asia/Kolkata')::date::text as day"))
    .rows[0].day;
  const metrics = await as('authenticated', owner, () =>
    rpc('pilot_daily_metrics', [location, day]),
  );
  expect(metrics.collections.received).toBe(226);
  expect(metrics.collections.returned).toBe(10);
  expect(metrics.collections.net).toBe(216);
  expect(metrics.orders.ordered_total).toBeGreaterThan(metrics.collections.received);
  expect(metrics.billing.billed_total).toBeGreaterThan(0);
  expect(metrics.items.find((i: any) => i.name === 'Test Soup').quantity).toBeGreaterThan(0);
});
test('owners save validated branding and hours; closed schedules/holidays block orders without affecting existing receipts', async () => {
  const closed = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [String(i), { closed: true }]),
  );
  const save = (hours: any, holidays: string[] = [], timezone = 'Asia/Kolkata') =>
    rpc('pilot_save_branding', [
      restaurant,
      location,
      'Real restaurant description',
      'https://images.example.test/logo.png',
      'https://images.example.test/cover.png',
      '#204060',
      timezone,
      'INR',
      hours ? JSON.stringify(hours) : null,
      holidays,
    ]);
  await as('authenticated', outsider, async () => {
    await expect(save(null)).rejects.toThrow(/Owner branding/);
  });
  await as('authenticated', owner, async () => {
    await expect(save({ '0': { closed: true } })).rejects.toThrow(/seven-day/);
    await expect(save(null, [], 'Not/A_Timezone')).rejects.toThrow(/timezone/);
    await save(closed);
  });
  await expect(order()).rejects.toThrow(/configured ordering hours/);
  const today = (
    await db.query<any>("select (now() at time zone 'Asia/Kolkata')::date::text as day")
  ).rows[0].day;
  await as('authenticated', owner, () => save(null, [today]));
  await expect(order()).rejects.toThrow(/closed today/);
  await as('authenticated', owner, () => save(null, []));
  expect((await order()).id).toBeTruthy();
  expect(
    (await db.query<any>('select primary_color from public.restaurants where id=$1', [restaurant]))
      .rows[0].primary_color,
  ).toBe('#204060');
});
test('a settled and served table session closes from real events and the next QR order starts a new session', async () => {
  const tableId = uuid(),
    qr = 'qr_' + uuid();
  await db.query(
    "insert into public.restaurant_tables(id,location_id,display_name,capacity) values($1,$2,'Session Table',2)",
    [tableId, location],
  );
  await db.query('insert into public.table_qr_codes(table_id,public_token) values($1,$2)', [
    tableId,
    qr,
  ]);
  const o = await order(qr),
    b = await as('authenticated', owner, () => bill([o.id]));
  await as('authenticated', owner, () => payment(b.id, 226));
  await as('authenticated', kitchen, async () => {
    for (const status of ['accepted', 'preparing', 'ready', 'served'])
      await rpc('update_order_status_secure', [o.id, status, null]);
  });
  await as('authenticated', owner, () => rpc('pilot_complete_bill', [b.id]));
  const session = (
    await db.query<any>(
      'select s.id,s.status,s.closed_at from public.table_sessions s join public.orders o on o.table_session_id=s.id where o.id=$1',
      [o.id],
    )
  ).rows[0];
  expect(session.status).toBe('closed');
  expect(session.closed_at).toBeTruthy();
  const next = await order(qr);
  expect(
    (await db.query<any>('select table_session_id from public.orders where id=$1', [next.id]))
      .rows[0].table_session_id,
  ).not.toBe(session.id);
});
