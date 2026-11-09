// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';

let db: PGlite;
const baseMigration = readFileSync(
  'supabase/migrations/20261109125008_v3_stabilization.sql',
  'utf8',
);
const followupMigration = readFileSync(
  'supabase/migrations/20261109191729_v3_menu_refresh_permissions.sql',
  'utf8',
);
const migration = baseMigration + '\n' + followupMigration;
const ownerA = randomUUID(),
  ownerB = randomUUID(),
  employee = randomUUID();
const orgA = randomUUID(),
  orgB = randomUUID(),
  restA = randomUUID(),
  restB = randomUUID(),
  locA = randomUUID(),
  locB = randomUUID();
const areaA = randomUUID(),
  areaB = randomUUID(),
  tableA = randomUUID(),
  tableB = randomUUID(),
  categoryA = randomUUID(),
  categoryB = randomUUID(),
  itemA = randomUUID(),
  itemB = randomUUID();
const group = randomUUID(),
  option = randomUUID();
const tokenA = 'qr_' + randomUUID(),
  tokenB = 'qr_' + randomUUID();
async function asRole<T>(role: string, user: string | null, run: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
  try {
    return await run();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
}
async function place(overrides: Record<string, unknown> = {}) {
  const data = {
    token: tokenA,
    items: [{ menu_item_id: itemA, quantity: 2, modifiers: [] }],
    name: 'Test Diner',
    phone: '+919000000001',
    key: randomUUID(),
    customer: null,
    expected: 226,
    ...overrides,
  };
  const result = await db.query<{ result: any }>(
    "select public.place_qr_order_idempotent($1,$2::jsonb,$3,$4,$5,'cash',0,null,'dine_in',$6,null,$7) as result",
    [
      data.token,
      JSON.stringify(data.items),
      data.name,
      data.phone,
      data.key,
      data.customer,
      data.expected,
    ],
  );
  return result.rows[0].result.order;
}
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(
    'set check_function_bodies=off;' + readFileSync('tests/fixtures/schema-before-v3.sql', 'utf8'),
  );
  await db.exec(readFileSync('tests/fixtures/triggers-before-v3.sql', 'utf8'));
  await db.exec('create publication supabase_realtime;');
  await db.exec(migration);
  await db.query(
    "insert into auth.users(id,email) values ($1,'owner-a@example.test'),($2,'owner-b@example.test'),($3,'staff@example.test')",
    [ownerA, ownerB, employee],
  );
  await db.query(
    "insert into public.organizations(id,name,country_code,default_currency,default_timezone) values ($1,'Tenant A','IN','INR','Asia/Kolkata'),($2,'Tenant B','IN','INR','Asia/Kolkata')",
    [orgA, orgB],
  );
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role,is_active) values ($1,$2,'owner',true),($3,$4,'owner',true),($1,$5,'staff',true)",
    [orgA, ownerA, orgB, ownerB, employee],
  );
  await db.query(
    "insert into public.staff_members(organization_id,user_id,status) values ($1,$2,'active'),($3,$4,'active'),($1,$5,'invited')",
    [orgA, ownerA, orgB, ownerB, employee],
  );
  await db.query(
    "insert into public.restaurants(id,organization_id,name,slug,status,tax_rate_percent,service_charge_percent) values ($1,$2,'A','a','active',8,5),($3,$4,'B','b','active',8,5)",
    [restA, orgA, restB, orgB],
  );
  await db.query(
    "insert into public.restaurant_locations(id,organization_id,restaurant_id,name,country_code,timezone,currency) values ($1,$2,$3,'A','IN','Asia/Kolkata','INR'),($4,$5,$6,'B','IN','Asia/Kolkata','INR')",
    [locA, orgA, restA, locB, orgB, restB],
  );
  await db.query(
    "insert into public.restaurant_areas(id,location_id,name) values ($1,$2,'A'),($3,$4,'B')",
    [areaA, locA, areaB, locB],
  );
  await db.query(
    "insert into public.restaurant_tables(id,location_id,area_id,display_name,capacity) values ($1,$2,$3,'Table 1',4),($4,$5,$6,'Table 2',4)",
    [tableA, locA, areaA, tableB, locB, areaB],
  );
  await db.query(
    'insert into public.table_qr_codes(table_id,public_token) values ($1,$2),($3,$4)',
    [tableA, tokenA, tableB, tokenB],
  );
  await db.query(
    "insert into public.menu_categories(id,restaurant_id,name) values ($1,$2,'Mains'),($3,$4,'Mains')",
    [categoryA, restA, categoryB, restB],
  );
  await db.query(
    "insert into public.menu_items(id,restaurant_id,category_id,name,base_price,currency) values ($1,$2,$3,'Dish A',100,'INR'),($4,$5,$6,'Dish B',100,'INR')",
    [itemA, restA, categoryA, itemB, restB, categoryB],
  );
  await db.query(
    "insert into public.modifier_groups(id,restaurant_id,name,minimum_selections,maximum_selections) values ($1,$2,'Toppings',0,1)",
    [group, restA],
  );
  await db.query(
    "insert into public.modifier_options(id,modifier_group_id,name,price_adjustment) values ($1,$2,'Extra',10)",
    [option, group],
  );
  await db.query(
    'insert into public.menu_item_modifier_groups(menu_item_id,modifier_group_id) values ($1,$2)',
    [itemA, group],
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
test('review migration compiles without production access', async () => {
  const result = await db.query<{ name: string }>(
    "select proname as name from pg_proc where proname='place_qr_order_idempotent'",
  );
  expect(result.rows).toHaveLength(1);
});
test('migration can be applied again without dropping tenant data', async () => {
  await db.exec(migration);
  expect((await db.query('select id from public.restaurants')).rows).toHaveLength(2);
});
test('anonymous menu access remains available, QR token enumeration is forbidden', async () => {
  await asRole('anon', null, async () => {
    expect((await db.query('select id from public.menu_items')).rows).toHaveLength(2);
    await expect(db.query('select public_token from public.table_qr_codes')).rejects.toThrow(
      /permission denied/i,
    );
  });
});
test('QR resolution selects the token tenant independently of an authenticated owner', async () => {
  await asRole('authenticated', ownerA, async () => {
    const r = await db.query<any>('select * from public.resolve_qr_context($1)', [tokenB]);
    expect(r.rows[0].restaurant_id).toBe(restB);
  });
  await asRole('anon', null, async () => {
    await expect(
      db.query('select * from public.resolve_qr_context($1)', ['qr_invalid_invalid_invalid']),
    ).rejects.toThrow(/invalid/i);
  });
});
test('revoked QR codes cannot resolve or place orders', async () => {
  const token = 'qr_' + randomUUID();
  const qr = await db.query<any>(
    "insert into public.table_qr_codes(table_id,public_token,status) values ($1,$2,'revoked') returning id",
    [tableA, token],
  );
  await asRole('anon', null, async () => {
    await expect(place({ token })).rejects.toThrow(/revoked|invalid/i);
  });
  await db.query('delete from public.table_qr_codes where id=$1', [qr.rows[0].id]);
});
test('guest orders are server priced, anonymous, trackable and idempotent', async () => {
  await asRole('anon', null, async () => {
    const key = randomUUID();
    const first = await place({ key });
    const second = await place({ key });
    expect(second.id).toBe(first.id);
    expect(Number(first.grand_total)).toBe(226);
    expect(first.payment_status).toBe('unpaid');
    expect(first.public_tracking_token.length).toBeGreaterThanOrEqual(32);
    expect(first).not.toHaveProperty('customer');
    expect(first).not.toHaveProperty('customer_id');
    await expect(place({ key, name: 'Different Diner' })).rejects.toThrow(/different order/i);
    await expect(
      db.query('select * from public.get_public_order_snapshot($1,$2)', [
        first.id,
        'invalid_tracking_token_long_enough',
      ]),
    ).rejects.toThrow(/not found/i);
  });
});
test('guest payload cannot nominate a customer, spoof price or cross restaurant boundaries', async () => {
  await asRole('anon', null, async () => {
    await expect(place({ customer: randomUUID() })).rejects.toThrow(/Customer IDs/i);
    await expect(
      place({ items: [{ menu_item_id: itemA, quantity: 1, price: 1, modifiers: [] }] }),
    ).rejects.toThrow(/server/i);
    await expect(
      place({ items: [{ menu_item_id: itemB, quantity: 1, modifiers: [] }] }),
    ).rejects.toThrow(/unavailable/i);
    await expect(place({ phone: '' })).rejects.toThrow(/mobile/i);
    await expect(place({ expected: 1 })).rejects.toThrow(/prices or charges changed/i);
  });
});
test('modifier ownership, selection counts and duplicates are checked on the server', async () => {
  await asRole('anon', null, async () => {
    await expect(
      place({
        items: [
          { menu_item_id: itemA, quantity: 1, modifiers: [{ modifier_option_id: randomUUID() }] },
        ],
      }),
    ).rejects.toThrow(/modifier/i);
    await expect(
      place({
        items: [
          {
            menu_item_id: itemA,
            quantity: 1,
            modifiers: [{ modifier_option_id: option }, { modifier_option_id: option }],
          },
        ],
      }),
    ).rejects.toThrow(/Duplicate modifiers/i);
    const result = await place({
      items: [{ menu_item_id: itemA, quantity: 1, modifiers: [{ modifier_option_id: option }] }],
      expected: 124.3,
    });
    expect(Number(result.grand_total)).toBe(124.3);
  });
});
test('unverified phone reuse never overwrites an earlier guest or reveals history', async () => {
  const phone = '+919000000009';
  await asRole('anon', null, async () => {
    await place({ name: 'First Guest', phone });
    await place({ name: 'Second Guest', phone });
  });
  const result = await db.query<any>(
    'select name,auth_user_id,phone_verified from public.customers where phone=$1 order by name',
    [phone],
  );
  expect(result.rows.map((r) => r.name)).toEqual(['First Guest', 'Second Guest']);
  expect(result.rows.every((r) => r.auth_user_id === null && !r.phone_verified)).toBe(true);
  await asRole('anon', null, async () => {
    await expect(
      db.query('select * from public.customers where phone=$1', [phone]),
    ).rejects.toThrow(/permission denied/i);
  });
});
test('tenant B cannot read or change tenant A orders; direct order writes are forbidden', async () => {
  const order = await asRole('anon', null, () => place());
  await asRole('authenticated', ownerB, async () => {
    expect(
      (await db.query('select id from public.orders where id=$1', [order.id])).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.update_order_status_secure($1,'accepted')", [order.id]),
    ).rejects.toThrow(/access denied/i);
  });
  await asRole('authenticated', ownerA, async () => {
    await expect(
      db.query("update public.orders set status='completed' where id=$1", [order.id]),
    ).rejects.toThrow(/permission denied/i);
  });
});
test('inactive employees cannot access orders; approved assigned employees can', async () => {
  await asRole('authenticated', employee, async () => {
    expect((await db.query('select * from public.orders')).rows).toHaveLength(0);
  });
  const member = await db.query<any>(
    'select id from public.organization_members where organization_id=$1 and user_id=$2',
    [orgA, employee],
  );
  await asRole('authenticated', ownerA, async () => {
    await db.query("select public.set_staff_access($1,'staff',true)", [member.rows[0].id]);
  });
  const roleId = randomUUID();
  await db.query(
    "insert into public.roles(id,organization_id,name) values($1,$2,'Test floor role')",
    [roleId, orgA],
  );
  await db.query(
    'insert into public.staff_location_assignments(staff_member_id,location_id,role_id) select id,$1,$4 from public.staff_members where organization_id=$2 and user_id=$3',
    [locA, orgA, employee, roleId],
  );
  await asRole('authenticated', employee, async () => {
    expect((await db.query('select * from public.orders')).rows.length).toBeGreaterThan(0);
    await expect(
      db.query("update public.organization_members set role='owner' where user_id=$1", [employee]),
    ).rejects.toThrow(/permission denied/i);
  });
});
test('status transitions are ordered, same-state retry creates no duplicate event', async () => {
  const order = await asRole('anon', null, () => place());
  await asRole('authenticated', ownerA, async () => {
    await expect(
      db.query("select public.update_order_status_secure($1,'completed')", [order.id]),
    ).rejects.toThrow(/transition/i);
    await db.query("select public.update_order_status_secure($1,'accepted')", [order.id]);
    await db.query("select public.update_order_status_secure($1,'accepted')", [order.id]);
  });
  expect(
    (await db.query('select * from public.order_status_events where order_id=$1', [order.id])).rows,
  ).toHaveLength(2);
});
test('tracking expires after 24 hours', async () => {
  const order = await asRole('anon', null, () => place());
  await db.query("update public.orders set created_at=now()-interval '25 hours' where id=$1", [
    order.id,
  ]);
  await asRole('anon', null, async () => {
    await expect(
      db.query('select public.get_public_order_snapshot($1,$2)', [
        order.id,
        order.public_tracking_token,
      ]),
    ).rejects.toThrow(/expired/i);
  });
});
test('public endpoints have intentional grants and provisioning metadata cannot grant access', async () => {
  await asRole('anon', null, async () => {
    await expect(
      db.query("select public.place_qr_order($1,'[]'::jsonb,'Test','9000000000')", [tokenA]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query(
        "select public.create_restaurant_onboarding(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'[]')",
      ),
    ).rejects.toThrow(/permission denied/i);
  });
  const user = randomUUID();
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,'forged@example.test',$2)",
    [user, JSON.stringify({ role: 'staff', organization_id: orgA, staff_role: 'admin' })],
  );
  expect(
    (await db.query('select id from public.organization_members where user_id=$1', [user])).rows,
  ).toHaveLength(0);
});
test('service requests are rate-limited without disabling anonymous ordering', async () => {
  await asRole('anon', null, async () => {
    for (let i = 0; i < 12; i++)
      await db.query("select public.create_guest_service_request($1,'need_water','Test request')", [
        tokenA,
      ]);
    await expect(
      db.query("select public.create_guest_service_request($1,'need_water','Test request')", [
        tokenA,
      ]),
    ).rejects.toThrow(/Too many requests/i);
  });
});
test('settings update is authorized and rejects a location from another tenant atomically', async () => {
  await asRole('authenticated', ownerA, async () => {
    await expect(
      db.query(
        "select public.update_restaurant_settings_secure($1,$2,'Bad rename','Cafe','Street','9000000000',8,5)",
        [restA, locB],
      ),
    ).rejects.toThrow(/Location does not belong/);
    await db.query(
      "select public.update_restaurant_settings_secure($1,$2,'Restaurant A Updated','Cafe','Street','9000000000',8,5)",
      [restA, locA],
    );
  });
  expect(
    (await db.query<any>('select name from public.restaurants where id=$1', [restA])).rows[0].name,
  ).toBe('Restaurant A Updated');
  await asRole('authenticated', ownerB, async () => {
    await expect(
      db.query(
        "select public.update_restaurant_settings_secure($1,$2,'Bad rename','Cafe','','',8,5)",
        [restA, locA],
      ),
    ).rejects.toThrow(/access required/);
  });
});
test('tenant parent relationships and owner safeguards are enforced', async () => {
  await asRole('authenticated', ownerA, async () => {
    await expect(
      db.query(
        "insert into public.menu_items(restaurant_id,category_id,name,base_price,currency) values($1,$2,'Invalid item',10,'INR')",
        [restA, categoryB],
      ),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      db.query(
        "insert into public.restaurant_tables(location_id,area_id,display_name,capacity) values($1,$2,'Invalid table',4)",
        [locA, areaB],
      ),
    ).rejects.toThrow(/row-level security/i);
    const member = await db.query<any>(
      'select id from public.organization_members where organization_id=$1 and user_id=$2',
      [orgA, ownerA],
    );
    await expect(
      db.query("select public.set_staff_access($1,'staff',false)", [member.rows[0].id]),
    ).rejects.toThrow(/last active owner/i);
  });
});
test('repeat onboarding is rejected before creating any new restaurant', async () => {
  await asRole('authenticated', ownerA, async () => {
    await expect(
      db.query(
        "select public.create_restaurant_onboarding($1,'Another','Cafe','Main','Street','City','','','IN','INR','Asia/Kolkata',null,null,null,'Dining','[{\"name\":\"Table 1\",\"capacity\":4}]')",
        [orgA],
      ),
    ).rejects.toThrow(/already has a restaurant/i);
  });
  expect(
    (await db.query('select id from public.restaurants where organization_id=$1', [orgA])).rows,
  ).toHaveLength(1);
});

test('Realtime publication membership is enabled for orders and service requests', async () => {
  expect(
    (
      await db.query(
        "select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename",
      )
    ).rows,
  ).toEqual(
    [
      'menu_categories',
      'menu_item_location_settings',
      'menu_item_modifier_groups',
      'menu_items',
      'modifier_groups',
      'modifier_options',
      'orders',
      'restaurants',
      'service_requests',
    ].map((tablename) => ({ tablename })),
  );
});

test('a new owner can atomically onboard tables with resolvable persisted QR codes', async () => {
  const newOwner = randomUUID();
  const newOrg = randomUUID();
  await db.query("insert into auth.users(id,email) values($1,'onboarding@example.test')", [
    newOwner,
  ]);
  await db.query(
    "insert into public.organizations(id,name,country_code,default_currency,default_timezone) values($1,'New Demo','IN','INR','Asia/Kolkata')",
    [newOrg],
  );
  await db.query(
    "insert into public.organization_members(organization_id,user_id,role,is_active) values($1,$2,'owner',true)",
    [newOrg, newOwner],
  );
  const result = await asRole('authenticated', newOwner, async () =>
    db.query<any>(
      "select public.create_restaurant_onboarding($1,'New Demo','Cafe','Main','Street','City','','','IN','INR','Asia/Kolkata',null,null,null,'Dining','[{\"name\":\"Table 1\",\"capacity\":4},{\"name\":\"Table 2\",\"capacity\":2}]') as result",
      [newOrg],
    ),
  );
  expect(result.rows[0].result.table_count).toBe(2);
  const tokens = await db.query<any>(
    'select q.public_token from public.table_qr_codes q join public.restaurant_tables t on t.id=q.table_id join public.restaurant_locations l on l.id=t.location_id where l.organization_id=$1',
    [newOrg],
  );
  expect(tokens.rows).toHaveLength(2);
  await asRole('anon', null, async () => {
    const resolved = await db.query<any>('select * from public.resolve_qr_context($1)', [
      tokens.rows[0].public_token,
    ]);
    expect(resolved.rows[0].restaurant_id).toBe(result.rows[0].result.restaurant_id);
  });
});

test('live helper ACL reproduces the legacy service error; ordered migrations repair it without public access', async () => {
  const legacy = await PGlite.create();
  try {
    await legacy.exec(
      'set check_function_bodies=off;' +
        readFileSync('tests/fixtures/schema-before-v3.sql', 'utf8'),
    );
    await legacy.exec(readFileSync('tests/fixtures/triggers-before-v3.sql', 'utf8'));
    const id = randomUUID();
    await legacy.query(
      'insert into auth.users(id,email,raw_user_meta_data) values($1,\'legacy@example.test\',\'{"role":"staff","organization_name":"Legacy demo"}\')',
      [id],
    );
    const member = await legacy.query<any>(
      'select organization_id from public.organization_members where user_id=$1',
      [id],
    );
    const org = member.rows[0].organization_id;
    const rest = await legacy.query<any>(
      "insert into public.restaurants(organization_id,name,slug,status) values($1,'Legacy demo','legacy','active') returning id",
      [org],
    );
    const location = await legacy.query<any>(
      "insert into public.restaurant_locations(organization_id,restaurant_id,name,country_code,timezone,currency) values($1,$2,'Main','IN','Asia/Kolkata','INR') returning id",
      [org, rest.rows[0].id],
    );
    await legacy.query(
      "insert into public.service_requests(location_id,request_type) values($1,'need_water')",
      [location.rows[0].id],
    );
    await legacy.exec('set role authenticated');
    await legacy.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await expect(legacy.query('select * from public.service_requests')).rejects.toThrow(
      /permission denied for function current_customer_id/i,
    );
    await legacy.exec('reset role');
    await expect(legacy.exec(followupMigration)).rejects.toThrow(/Apply .* first.*missing/i);
    await legacy.exec('rollback');
    await legacy.exec(migration);
    await legacy.exec('set role authenticated');
    await legacy.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    expect((await legacy.query('select * from public.service_requests')).rows).toHaveLength(1);
    expect(
      (await legacy.query<any>('select public.current_customer_id() as id')).rows[0].id,
    ).toBeNull();
    await legacy.exec('reset role;set role anon');
    await expect(legacy.query('select public.current_customer_id()')).rejects.toThrow(
      /permission denied/i,
    );
    await expect(legacy.query('select * from public.service_requests')).rejects.toThrow(
      /permission denied/i,
    );
  } finally {
    await legacy.close();
  }
});
test('authenticated customer helper is caller-bound and service reads remain tenant-isolated', async () => {
  const a = await db.query<any>(
    "insert into public.customers(organization_id,auth_user_id,name) values($1,$2,'Claimed A') returning id",
    [orgA, ownerA],
  );
  const b = await db.query<any>(
    "insert into public.customers(organization_id,auth_user_id,name) values($1,$2,'Claimed B') returning id",
    [orgB, ownerB],
  );
  await asRole('authenticated', ownerA, async () => {
    expect((await db.query<any>('select public.current_customer_id() as id')).rows[0].id).toBe(
      a.rows[0].id,
    );
    expect((await db.query('select * from public.service_requests')).rows.length).toBeGreaterThan(
      0,
    );
  });
  await asRole('authenticated', ownerB, async () => {
    expect((await db.query<any>('select public.current_customer_id() as id')).rows[0].id).toBe(
      b.rows[0].id,
    );
    expect((await db.query('select * from public.service_requests')).rows).toHaveLength(0);
  });
});
