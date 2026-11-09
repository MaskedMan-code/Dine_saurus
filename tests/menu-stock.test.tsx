import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { RestaurantProvider, useRestaurant } from '../src/context/RestaurantContext';

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  setLocation: vi.fn(),
  stockError: false,
  serviceError: false,
  itemReadWait: null as Promise<void> | null,
  itemReads: 0,
  writes: [] as any[],
  items: [] as any[],
  settings: [] as any[],
}));
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    customer: null,
    staff: { organizationId: 'org', isActive: true, role: 'owner' },
    isStaff: true,
    user: { id: 'owner' },
    refreshProfile: vi.fn(),
  }),
}));
vi.mock('../src/context/TenantContext', () => ({
  useTenant: () => ({
    activeRestaurantId: 'restaurant',
    activeLocationId: 'location',
    organizationId: 'org',
    source: 'staff-org',
    setActiveLocationId: mock.setLocation,
    resolvedTableId: null,
    publicTableToken: null,
    loading: false,
    error: null,
  }),
}));
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: mock.from,
    channel: () => {
      const channel: any = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));
const baseItem = {
  id: 'item',
  restaurant_id: 'restaurant',
  category_id: 'category',
  name: 'Soup',
  base_price: 100,
  currency: 'INR',
  active: true,
};
const locations = [
  {
    id: 'location',
    restaurant_id: 'restaurant',
    name: 'Main',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  },
];
beforeEach(() => {
  mock.stockError = false;
  mock.serviceError = false;
  mock.itemReadWait = null;
  mock.itemReads = 0;
  mock.writes = [];
  mock.items = [{ ...baseItem }];
  mock.settings = [
    {
      menu_item_id: 'item',
      location_id: 'location',
      price_override: 120,
      available: true,
      sold_out: false,
    },
  ];
  mock.from.mockReset();
  mock.from.mockImplementation((table: string) => {
    const request: any = { table, operation: 'read', values: null, filters: {}, single: false };
    const chain: any = {
      select: () => chain,
      order: () => chain,
      in: () => chain,
      abortSignal: () => chain,
      eq: (column: string, value: any) => {
        request.filters[column] = value;
        return chain;
      },
      single: () => {
        request.single = true;
        return chain;
      },
      maybeSingle: () => {
        request.single = true;
        return chain;
      },
      update: (values: any) => {
        request.operation = 'update';
        request.values = values;
        return chain;
      },
      insert: (values: any) => {
        request.operation = 'insert';
        request.values = values;
        return chain;
      },
      upsert: (values: any) => {
        request.operation = 'upsert';
        request.values = values;
        return chain;
      },
      delete: () => {
        request.operation = 'delete';
        return chain;
      },
      then: (resolve: any, reject: any) =>
        Promise.resolve()
          .then(async () => {
            if (table === 'menu_items' && request.operation === 'read') {
              mock.itemReads++;
              if (mock.itemReadWait) await mock.itemReadWait;
            }
            if (request.operation !== 'read')
              mock.writes.push({ ...request, filters: { ...request.filters } });
            if (table === 'menu_item_location_settings' && request.operation === 'upsert') {
              if (mock.stockError) return { data: null, error: { message: 'stock write denied' } };
              const saved = mock.settings.find(
                (s) => s.menu_item_id === request.values.menu_item_id,
              ) ?? { available: true, price_override: null };
              Object.assign(saved, request.values);
              if (!mock.settings.includes(saved)) mock.settings.push(saved);
            }
            if (table === 'menu_items' && request.operation === 'insert')
              mock.items.push({ ...request.values[0], id: 'new-item' });
            if (table === 'menu_items' && request.operation === 'update')
              Object.assign(
                mock.items.find((i) => i.id === request.filters.id)!,
                request.values,
              );
            if (table === 'menu_items' && request.operation === 'delete') {
              const removed = mock.items.filter((i) => i.id === request.filters.id);
              mock.items = mock.items.filter((i) => i.id !== request.filters.id);
              return { data: removed, error: null };
            }
            if (table === 'service_requests' && mock.serviceError)
              return {
                data: null,
                error: { message: 'permission denied for function current_customer_id' },
              };
            const rows =
              table === 'menu_items'
                ? mock.items
                : table === 'menu_item_location_settings'
                  ? mock.settings
                  : table === 'restaurants'
                    ? [
                        {
                          id: 'restaurant',
                          organization_id: 'org',
                          name: 'Restaurant',
                          tax_rate_percent: 8,
                          service_charge_percent: 5,
                        },
                      ]
                    : table === 'restaurant_locations'
                      ? locations
                      : table === 'menu_categories'
                        ? [
                            {
                              id: 'category',
                              restaurant_id: 'restaurant',
                              name: 'Mains',
                              active: true,
                            },
                          ]
                        : [];
            const filtered = rows.filter(
              (row) =>
                Object.entries(request.filters).every(([key, value]) => row[key] === value) &&
                (request.operation !== 'upsert' ||
                  row.menu_item_id === request.values.menu_item_id),
            );
            return {
              data: request.single ? (filtered[0] ?? null) : filtered.map((row) => ({ ...row })),
              error: null,
            };
          })
          .then(resolve, reject),
    };
    return chain;
  });
});
function Probe() {
  const r = useRestaurant();
  const [result, setResult] = useState<string>('');
  return (
    <>
      <output data-testid="items">{JSON.stringify(r.menuItems)}</output>
      <output data-testid="result">{result}</output>
      <p role="alert">{r.mutationError}</p>
      <button onClick={r.retryLoad}>Refresh catalog</button>
      <button
        onClick={async () => {
          setResult(String(await r.saveMenuItem({ ...r.menuItems[0], isSoldOut: true })));
        }}
      >
        Save sold out
      </button>
      <button
        onClick={async () => {
          setResult(String(await r.saveMenuItem({ ...r.menuItems[0], isSoldOut: false })));
        }}
      >
        Save in stock
      </button>
      <button onClick={() => void r.toggleItemSoldOut('item')}>Quick toggle</button>
      <button
        onClick={async () => {
          setResult(
            String(
              await r.saveMenuItem({
                ...r.menuItems[0],
                id: 'draft',
                name: 'New Soup',
                isSoldOut: true,
              }),
            ),
          );
        }}
      >
        Create sold out
      </button>
    </>
  );
}
async function mount() {
  render(
    <RestaurantProvider>
      <Probe />
    </RestaurantProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('Soup'));
}
function firstItem() {
  return JSON.parse(screen.getByTestId('items').textContent!)[0];
}
test('Edit Item saves and restores location stock without losing its price override or changing another location', async () => {
  await mount();
  fireEvent.click(screen.getByText('Save sold out'));
  await waitFor(() => expect(firstItem().isSoldOut).toBe(true));
  expect(mock.items[0].base_price).toBe(100);
  expect(mock.items[0].active).toBe(true);
  expect(firstItem().price).toBe(120);
  expect(mock.writes.find((w) => w.operation === 'upsert').values).toEqual({
    menu_item_id: 'item',
    location_id: 'location',
    sold_out: true,
  });
  fireEvent.click(screen.getByText('Save in stock'));
  await waitFor(() => expect(firstItem().isSoldOut).toBe(false));
  expect(mock.settings[0].price_override).toBe(120);
});
test('quick stock action uses the same location setting and remains out of stock when the location is disabled', async () => {
  mock.settings[0].available = false;
  await mount();
  fireEvent.click(screen.getByText('Quick toggle'));
  await waitFor(() => expect(mock.writes.some((w) => w.operation === 'upsert')).toBe(true));
  expect(firstItem().isSoldOut).toBe(true);
});
test('stock write failure reports failure and preserves authoritative availability', async () => {
  await mount();
  mock.stockError = true;
  fireEvent.click(screen.getByText('Save sold out'));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  expect(screen.getByRole('alert')).toHaveTextContent('stock write denied');
  expect(firstItem().isSoldOut).toBe(false);
});
test('a new sold-out item is not published until its location stock is saved', async () => {
  await mount();
  fireEvent.click(screen.getByText('Create sold out'));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('true'));
  const writes = mock.writes;
  expect(writes[0].values[0].active).toBe(false);
  expect(writes[1].table).toBe('menu_item_location_settings');
  expect(writes[1].values.sold_out).toBe(true);
  expect(writes[2].values.active).toBe(true);
});
test('a failed new-item stock write removes the unpublished item instead of reporting success', async () => {
  await mount();
  mock.stockError = true;
  fireEvent.click(screen.getByText('Create sold out'));
  await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('false'));
  expect(mock.items).toHaveLength(1);
});
test('legacy service policy failure gives an actionable migration error', async () => {
  mock.serviceError = true;
  await mount();
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('database permissions update'),
  );
});
test('repeated refresh signals during an in-flight catalog load queue one reconciliation', async () => {
  let release!: () => void;
  mock.itemReadWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  render(
    <RestaurantProvider>
      <Probe />
    </RestaurantProvider>,
  );
  await waitFor(() => expect(mock.itemReads).toBe(1));
  fireEvent.click(screen.getByText('Refresh catalog'));
  fireEvent.click(screen.getByText('Refresh catalog'));
  fireEvent.click(screen.getByText('Refresh catalog'));
  expect(mock.itemReads).toBe(1);
  mock.itemReadWait = null;
  release();
  await waitFor(() => expect(mock.itemReads).toBe(2));
  await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('Soup'));
});
