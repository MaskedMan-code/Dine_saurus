import { test, expect, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const project = 'https://supabase.example.test';
const uid = '00000000-0000-4000-8000-000000000001';
const fixtures = (tenant = 'A') => {
  const suffix = tenant === 'A' ? '1' : '2';
  const id = (n: string) => `00000000-0000-4000-800${suffix}-${n.padStart(12, '0')}`;
  return {
    org: id('1'),
    rest: id('2'),
    location: id('3'),
    area: id('4'),
    table: id('5'),
    category: id('6'),
    item: id('7'),
    token: `qr_test_tenant_${tenant}_000000000000`,
    tenant,
  };
};
const makeOrder = (f = fixtures()) => ({
  id: '00000000-0000-4000-8000-000000000099',
  public_order_number: 'ORD-TEST',
  public_tracking_token: 'test_tracking_token_000000000000000000000000000000000000',
  restaurant_id: f.rest,
  location_id: f.location,
  table_id: f.table,
  service_mode: 'dine_in',
  status: 'pending',
  payment_status: 'unpaid',
  payment_method: 'cash',
  currency: 'INR',
  subtotal: 100,
  tax_total: 8,
  discount_total: 0,
  service_charge_total: 5,
  tip_total: 0,
  grand_total: 113,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  order_items: [
    {
      id: 'line',
      menu_item_id: f.item,
      item_name_snapshot: `Soup ${f.tenant}`,
      quantity: 1,
      unit_price: 100,
      line_total: 100,
      order_item_modifiers: [],
    },
  ],
  order_status_events: [{ to_status: 'pending', created_at: new Date().toISOString() }],
});
type CatalogEvent = { table: string; record: any };
function createMenuState() {
  return {
    items: Object.fromEntries(
      ['A', 'B'].map((tenant) => {
        const f = fixtures(tenant);
        return [
          tenant,
          {
            id: f.item,
            restaurant_id: f.rest,
            category_id: f.category,
            name: `Soup ${tenant}`,
            short_description: 'Fresh soup',
            base_price: 100,
            currency: 'INR',
            active: true,
            featured: false,
          },
        ];
      }),
    ),
    stock: {} as Record<string, any>,
    listeners: new Set<(event: CatalogEvent) => void>(),
  };
}
async function backend(
  page: Page,
  options: {
    failOrder?: boolean;
    emptyOrg?: boolean;
    missingOrderRpc?: boolean;
    failStock?: boolean;
    menuState?: ReturnType<typeof createMenuState>;
  } = {},
) {
  const menu = options.menuState ?? createMenuState();
  const notify = (table: string, record: any) =>
    menu.listeners.forEach((listener) => listener({ table, record }));
  let order: any = null;
  let orderCalls = 0;
  const requests: string[] = [];
  const extraTables: any[] = [];
  const extraQrs: any[] = [];
  const channels = new Map<string, { socket: any; joinRef: any; filters: any[] }>();
  await page.route(`${project}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push(path);
    const body = request.postDataJSON() ?? {};
    const json = (value: any, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/auth/v1/token') {
      const payload = Buffer.from(
        JSON.stringify({
          sub: uid,
          exp: Math.floor(Date.now() / 1000) + 3600,
          role: 'authenticated',
          aud: 'authenticated',
        }),
      ).toString('base64url');
      return json({
        access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`,
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: uid,
          email: 'owner@example.test',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      });
    }
    if (path === '/auth/v1/logout') return json({});
    if (path === '/auth/v1/user') return json({ id: uid, email: 'owner@example.test' });
    if (path === '/rest/v1/rpc/resolve_qr_context') {
      if (body.p_public_token?.includes('invalid'))
        return json({ message: 'QR code is invalid or revoked', code: 'P0001' }, 400);
      const f = fixtures(body.p_public_token?.includes('tenant_B') ? 'B' : 'A');
      return json([
        {
          public_token: f.token,
          table_id:
            extraQrs.find((q) => q.public_token === body.p_public_token)?.table_id ?? f.table,
          location_id: f.location,
          restaurant_id: f.rest,
          organization_id: f.org,
          restaurant_name: `Restaurant ${f.tenant}`,
          restaurant_slug: `restaurant-${f.tenant.toLowerCase()}`,
        },
      ]);
    }
    if (path === '/rest/v1/rpc/place_qr_order_idempotent') {
      orderCalls++;
      if (options.missingOrderRpc)
        return json({ code: 'PGRST202', message: 'place_qr_order_idempotent was not found' }, 404);
      if (options.failOrder)
        return json(
          { message: 'A menu item is unavailable. Update your cart.', code: 'P0001' },
          400,
        );
      const f = fixtures(body.p_public_token?.includes('tenant_B') ? 'B' : 'A');
      order = makeOrder(f);
      return json({ order });
    }
    if (path === '/rest/v1/rpc/get_public_order_snapshot')
      return order ? json(order) : json({ message: 'Order not found' }, 400);
    if (path === '/rest/v1/rpc/update_order_status_secure') {
      order.status = body.p_new_status;
      return json({ order_id: order.id, status: order.status });
    }
    const resource = path.split('/').pop();
    if (resource === 'menu_items' && request.method() === 'PATCH') {
      const item = Object.values(menu.items).find(
        (row) => row.id === url.searchParams.get('id')?.slice(3),
      );
      if (!item) return json({ message: 'Item not found' }, 404);
      Object.assign(item, body);
      notify('menu_items', item);
      return json(item);
    }
    if (resource === 'menu_item_location_settings' && request.method() === 'POST') {
      if (options.failStock) return json({ code: '42501', message: 'Stock write denied' }, 403);
      const row = {
        available: true,
        price_override: null,
        ...menu.stock[body.location_id],
        ...body,
      };
      menu.stock[body.location_id] = row;
      notify('menu_item_location_settings', row);
      return json(row);
    }
    if (request.method() === 'POST' && resource === 'restaurant_tables') {
      const row = { ...body[0], id: '00000000-0000-4000-8001-000000000088', active: true };
      extraTables.push(row);
      return json(row);
    }
    if (request.method() === 'POST' && resource === 'table_qr_codes') {
      const row = { ...body[0], id: 'qr-new', scan_count: 0 };
      extraQrs.push(row);
      return json(row);
    }
    const selected =
      url.searchParams.get('restaurant_id')?.split('.').pop() ??
      url.searchParams.get('id')?.split('.').pop();
    const f =
      selected === fixtures('B').rest ||
      url.searchParams.get('location_id')?.includes(fixtures('B').location)
        ? fixtures('B')
        : fixtures('A');
    let rows: any[] = [];
    if (resource === 'profiles') rows = [{ id: uid, display_name: 'Test Owner', phone: null }];
    if (resource === 'organization_members')
      rows = [
        { id: 'membership', organization_id: f.org, user_id: uid, role: 'owner', is_active: true },
      ];
    if (resource === 'staff_members')
      rows = [{ id: 'employee', organization_id: f.org, user_id: uid, status: 'active' }];
    if (resource === 'restaurants')
      rows = options.emptyOrg
        ? []
        : [
            {
              id: f.rest,
              organization_id: f.org,
              name: `Restaurant ${f.tenant}`,
              slug: `restaurant-${f.tenant.toLowerCase()}`,
              status: 'active',
              restaurant_type: 'Test restaurant',
              tax_rate_percent: 8,
              service_charge_percent: 5,
            },
          ];
    if (resource === 'restaurant_locations')
      rows = [
        {
          id: f.location,
          restaurant_id: f.rest,
          organization_id: f.org,
          name: 'Main Location',
          city: 'Test City',
          currency: 'INR',
          country_code: 'IN',
          timezone: 'Asia/Kolkata',
          active: true,
        },
      ];
    if (resource === 'restaurant_areas')
      rows = [{ id: f.area, location_id: f.location, name: 'Dining room' }];
    if (resource === 'restaurant_tables')
      rows = [
        ...extraTables,
        {
          id: f.table,
          location_id: f.location,
          area_id: f.area,
          display_name: 'Table 1',
          capacity: 4,
          status: 'available',
          active: true,
        },
      ];
    if (resource === 'table_qr_codes')
      rows = [
        ...extraQrs,
        { id: 'qr-id', table_id: f.table, public_token: f.token, status: 'active', scan_count: 0 },
      ];
    if (resource === 'menu_categories')
      rows = [
        { id: f.category, restaurant_id: f.rest, name: 'Mains', sort_order: 0, active: true },
      ];
    if (resource === 'menu_items') rows = [menu.items[f.tenant]];
    if (resource === 'menu_item_location_settings')
      rows = menu.stock[f.location] ? [menu.stock[f.location]] : [];
    if (resource === 'orders') rows = order ? [order] : [];
    if (resource === 'organizations') rows = [{ id: f.org, join_code: 'TEST00' }];
    if (request.method() === 'HEAD')
      return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' });
    return json(
      request.headers()['accept']?.includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows,
    );
  });
  // Realtime protocol stays local too; no websocket is sent to a real Supabase project.
  await page.routeWebSocket('wss://supabase.example.test/**', (socket) => {
    socket.onClose(() => {
      for (const [topic, channel] of channels) {
        if (channel.socket === socket) channels.delete(topic);
      }
    });
    socket.onMessage((message) => {
      const frame = JSON.parse(message.toString());
      const [joinRef, ref, topic, event, payload] = frame;
      if (event === 'phx_join') {
        const filters = (payload.config?.postgres_changes ?? []).map(
          (filter: any, index: number) => ({ ...filter, id: index + 1 }),
        );
        channels.set(topic, { socket, joinRef, filters });
        socket.send(
          JSON.stringify([
            joinRef,
            ref,
            topic,
            'phx_reply',
            { status: 'ok', response: { postgres_changes: filters } },
          ]),
        );
      } else if (event === 'phx_leave') {
        channels.delete(topic);
        socket.send(
          JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]),
        );
      } else if (event === 'heartbeat')
        socket.send(
          JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]),
        );
    });
  });
  menu.listeners.add((event) => {
    for (const [topic, channel] of channels) {
      const ids = channel.filters
        .filter((filter) => {
          if (filter.table !== event.table) return false;
          if (!filter.filter) return true;
          const [key, expected] = filter.filter.split('=eq.');
          return event.record[key] === expected;
        })
        .map((filter) => filter.id);
      if (ids.length)
        channel.socket.send(
          JSON.stringify([
            channel.joinRef,
            null,
            topic,
            'postgres_changes',
            {
              ids,
              data: {
                type: 'UPDATE',
                schema: 'public',
                table: event.table,
                commit_timestamp: new Date().toISOString(),
                columns: [],
                record: event.record,
                old_record: {},
                errors: null,
              },
            },
          ]),
        );
    }
  });
  return {
    changeMenu(tenant: string, patch: Record<string, unknown>, emit = true) {
      Object.assign(menu.items[tenant], patch);
      if (emit) notify('menu_items', menu.items[tenant]);
    },
    requests,
    get orderCalls() {
      return orderCalls;
    },
    get persistedQr() {
      return extraQrs[0];
    },
    get activeChannels() {
      return channels.size;
    },
    deliverOrder() {
      order = makeOrder();
      for (const [topic, channel] of channels)
        channel.socket.send(
          JSON.stringify([
            channel.joinRef,
            null,
            topic,
            'postgres_changes',
            {
              ids: [1],
              data: {
                type: 'INSERT',
                schema: 'public',
                table: 'orders',
                commit_timestamp: new Date().toISOString(),
                columns: [],
                record: order,
                old_record: {},
                errors: null,
              },
            },
          ]),
        );
    },
  };
}
async function login(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('test-password-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function addSoup(page: Page) {
  await page.getByText('Soup A', { exact: true }).first().click();
  await page.getByRole('button', { name: /Add to Order/ }).click();
  await page
    .getByRole('button', { name: /View.*Order|Checkout|View cart/i })
    .first()
    .click();
}
test('owner module and session survive refresh and tab changes', async ({ page, context }) => {
  const api = await backend(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?view=pos');
  await login(page);
  await expect(page.getByText('Restaurant A', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /Kitchen \(KDS\)/ }).click();
  await expect(page.getByText('Kitchen Display System (KDS)', { exact: true })).toBeVisible();
  const start = await page.evaluate(() => performance.timeOrigin);
  const before = api.requests.filter((p) => p.endsWith('/profiles')).length;
  const another = await context.newPage();
  await another.goto('about:blank');
  await page.bringToFront();
  await expect(page.getByText('Kitchen Display System (KDS)', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(start);
  expect(api.requests.filter((p) => p.endsWith('/profiles')).length).toBe(before);
  await page.reload();
  await expect(page.getByText('Kitchen Display System (KDS)', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('customer QR takes priority over the signed-in owner organization', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=pos');
  await login(page);
  await expect(page.getByText('Restaurant A', { exact: true }).first()).toBeVisible();
  await page.goto(`/?view=customer&table=${fixtures('B').token}`);
  await expect(page.getByRole('heading', { name: 'Restaurant B', exact: true })).toBeVisible();
  await expect(page.getByText('Soup B', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Soup A', { exact: true })).toHaveCount(0);
});
test('invalid QR shows an error instead of another restaurant', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=customer&table=invalid_qr_token');
  await expect(page.getByText(/invalid or revoked/)).toBeVisible();
  await expect(page.getByText('Soup A', { exact: true })).toHaveCount(0);
});
test('guest can order without an account and restore tracking after refresh', async ({ page }) => {
  const api = await backend(page);
  await page.goto(`/?view=customer&table=${fixtures().token}`);
  await expect(page.getByText('Soup A', { exact: true }).first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath('guest-menu.png'), fullPage: true });
  await addSoup(page);
  await page.getByLabel('Full name (required)').fill('Test Diner');
  await page.getByLabel('Mobile number (required)').fill('+919000000001');
  await page.getByRole('button', { name: /Place Order/ }).click();
  await expect(page.getByText('Order ORD-TEST', { exact: true })).toBeVisible();
  expect(api.orderCalls).toBe(1);
  await page.reload();
  await expect(
    page.getByRole('button', { name: /Track.*Order|Track Order/i }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Track.*Order|Track Order/i })
    .first()
    .click();
  await expect(page.getByText('Order ORD-TEST', { exact: true })).toBeVisible();
});
test('failed checkout preserves the cart and shows retry feedback', async ({ page }) => {
  const api = await backend(page, { failOrder: true });
  await page.goto(`/?view=customer&table=${fixtures().token}`);
  await addSoup(page);
  await page.getByLabel('Full name (required)').fill('Test Diner');
  await page.getByLabel('Mobile number (required)').fill('+919000000001');
  await page.getByRole('button', { name: /Place Order/ }).click();
  await expect(page.getByRole('alert')).toHaveText(/unavailable/);
  await expect(page.getByRole('button', { name: /Retry order/ })).toBeEnabled();
  expect(api.orderCalls).toBe(1);
  await expect(page.getByLabel('Full name (required)')).toHaveValue('Test Diner');
});

test('table creation persists a QR that can be downloaded, decoded and scanned', async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto('/?view=tables');
  await login(page);
  await page.getByRole('button', { name: /Add.*Table/ }).click();
  await page.getByPlaceholder('e.g. Window Corner Table').fill('Table 8');
  await page.getByRole('button', { name: 'Save Table', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Table 8', exact: true })).toBeVisible();
  const card = page.getByTestId('table-00000000-0000-4000-8001-000000000088');
  await card.getByTitle('View & Download QR Code').click();
  await expect(page.getByAltText(/Table 8 QR Code/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = PNG.sync.read(Buffer.concat(chunks));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded).not.toBeNull();
  expect(new URL(decoded!.data).searchParams.get('table')).toBe(api.persistedQr.public_token);
  await page.goto(decoded!.data);
  await expect(page.getByRole('heading', { name: 'Restaurant A', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Table 8', exact: true })).toBeVisible();
});
test('onboarding draft survives module navigation and browser refresh', async ({ page }) => {
  await backend(page, { emptyOrg: true });
  await page.goto('/?view=pos');
  await login(page);
  await page.getByPlaceholder('e.g. Nordic Table').fill('Draft Restaurant');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByPlaceholder('e.g. Phoenix Palassio')).toBeVisible();
  await page.getByPlaceholder('e.g. Phoenix Palassio').fill('Draft Location');
  await page.reload();
  await expect(page.getByPlaceholder('e.g. Phoenix Palassio')).toHaveValue('Draft Location');
  await page.getByRole('button', { name: /Back/ }).click();
  await expect(page.getByPlaceholder('e.g. Nordic Table')).toHaveValue('Draft Restaurant');
});
test('realtime orders reach KDS without duplicate cards or accumulated subscriptions', async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto('/?view=kds');
  await login(page);
  await expect(page.getByText('Kitchen Display System (KDS)', { exact: true })).toBeVisible();
  await expect.poll(() => api.activeChannels).toBe(1);
  api.deliverOrder();
  await expect(page.getByText('ORD-TEST', { exact: false })).toHaveCount(1);
  await page.getByRole('button', { name: 'Accept Ticket', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Cooking', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'POS & Cashier', exact: true }).click();
  await page.getByRole('button', { name: 'Kitchen (KDS)', exact: true }).click();
  expect(api.activeChannels).toBe(1);
  await expect(page.getByText('ORD-TEST', { exact: false })).toHaveCount(1);
});
test('owner can sign out and sign back in', async ({ page }) => {
  await backend(page);
  await page.goto('/?view=pos');
  await login(page);
  await expect(page.getByText('Restaurant A', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Restaurant team sign in' })).toBeVisible();
  await login(page);
  await expect(page.getByText('Restaurant A', { exact: true }).first()).toBeVisible();
});

test('Edit Item stock changes reach an open guest cart and menu without a reload', async ({
  page,
  browser,
}) => {
  const state = createMenuState();
  await backend(page, { menuState: state });
  await page.goto('/?view=menu');
  await login(page);
  await expect(page.getByTitle('Edit Item')).toBeVisible();
  const guestContext = await browser.newContext({
    viewport: page.viewportSize()!,
    isMobile: test.info().project.name === 'mobile',
    hasTouch: test.info().project.name === 'mobile',
  });
  try {
    const guest = await guestContext.newPage();
    const guestApi = await backend(guest, { menuState: state });
    await guest.goto(`/?view=customer&table=${fixtures().token}`);
    await addSoup(guest);
    await guest.getByLabel('Full name (required)').fill('Persistent Diner');
    const timeOrigin = await guest.evaluate(() => performance.timeOrigin);
    await page.getByTitle('Edit Item').click();
    await page.getByLabel('Mark as Sold Out (86)').check();
    await page.getByRole('button', { name: 'Save Item', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sold Out (86)', exact: true })).toBeVisible();
    await expect(guest.getByText('Sold Out', { exact: true })).toHaveCount(1);
    await expect(guest.getByRole('dialog', { name: 'Checkout & Order' })).toBeVisible();
    await expect(guest.getByLabel('Full name (required)')).toHaveValue('Persistent Diner');
    await guest.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(guest.getByText('Sold Out', { exact: true })).toBeVisible();
    await page.getByTitle('Edit Item').click();
    await page.getByLabel('Mark as Sold Out (86)').uncheck();
    await page.getByRole('button', { name: 'Save Item', exact: true }).click();
    await expect(guest.getByText('Sold Out', { exact: true })).toHaveCount(0);
    guestApi.changeMenu('A', { name: 'Soup Updated', base_price: 125 });
    await expect(guest.getByText('Soup Updated', { exact: true }).first()).toBeVisible();
    await expect(guest.getByText('\u20b9125.00', { exact: true }).first()).toBeVisible();
    expect(await guest.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
    expect(guestApi.requests.filter((path) => path.endsWith('/profiles'))).toHaveLength(0);
  } finally {
    await guestContext.close();
  }
});
test('guest menu polling removes unpublished items even when no Realtime event is delivered', async ({
  page,
}) => {
  await page.clock.install();
  const api = await backend(page);
  await page.goto(`/?view=customer&table=${fixtures().token}`);
  await expect(page.getByText('Soup A', { exact: true })).toBeVisible();
  api.changeMenu('A', { active: false }, false);
  await page.clock.runFor(15300);
  await expect(page.getByText('Soup A', { exact: true })).toHaveCount(0);
});
test('checkout scrolls its details at small viewport heights while keeping payment and close controls reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await backend(page);
  await page.goto(`/?view=customer&table=${fixtures().token}`);
  await addSoup(page);
  const dialog = page.getByRole('dialog', { name: 'Checkout & Order' });
  const details = dialog.getByRole('region', { name: 'Checkout details' });
  await expect(dialog).toBeVisible();
  expect(await details.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const backgroundY = await page.evaluate(() => scrollY);
  await details.hover();
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => details.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(dialog.getByText('Total Amount', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Place Order/ })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(backgroundY);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});
test('an undeployed order RPC keeps the cart and offers an honest restaurant-setup error', async ({
  page,
}) => {
  const api = await backend(page, { missingOrderRpc: true });
  await page.goto(`/?view=customer&table=${fixtures().token}`);
  await addSoup(page);
  await page.getByLabel('Full name (required)').fill('Test Diner');
  await page.getByLabel('Mobile number (required)').fill('+919000000001');
  await page.getByRole('button', { name: /Place Order/ }).click();
  await expect(page.getByRole('alert')).toHaveText(/awaiting the V3 database update/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: /Retry order/ })).toBeEnabled();
  expect(api.orderCalls).toBe(1);
  expect(
    api.requests
      .filter((path) => path.includes('/rpc/place_qr_order'))
      .every((path) => path.endsWith('/place_qr_order_idempotent')),
  ).toBe(true);
});
