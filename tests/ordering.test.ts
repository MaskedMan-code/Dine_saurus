import { webcrypto } from 'node:crypto';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  createOrderSubmitter,
  loadTracking,
  saveTracking,
  TRACKING_TTL,
} from '../src/lib/ordering';
import { createTableWithQr } from '../src/lib/tables';
import { qrUrl, getViewMode } from '../src/lib/route';
import { orderTotals } from '../src/lib/money';
beforeEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
});
test('network retries reuse an idempotency key while changed payloads get a new key', async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: null, error: { message: 'network' } })
    .mockResolvedValue({ data: { order: { id: 'one' } }, error: null });
  const submit = createOrderSubmitter({ rpc } as any, 'tenant');
  await expect(submit({ p_items: [1] })).rejects.toThrow('network');
  await submit({ p_items: [1] });
  await submit({ p_items: [2] });
  expect(rpc.mock.calls[0][1].p_idempotency_key).toBe(rpc.mock.calls[1][1].p_idempotency_key);
  expect(rpc.mock.calls[2][1].p_idempotency_key).not.toBe(rpc.mock.calls[1][1].p_idempotency_key);
});
test('in-flight order calls share one request', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { order: { id: 'one' } }, error: null });
  const submit = createOrderSubmitter({ rpc } as any, 'tenant');
  await Promise.all([submit({ a: 1 }), submit({ a: 1 })]);
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('missing idempotent RPC preserves a retryable intent and never falls back to legacy ordering', async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Function missing' } })
    .mockResolvedValueOnce({ data: { order: { id: 'confirmed' } }, error: null });
  const submit = createOrderSubmitter({ rpc } as any, 'missing-rpc');
  await expect(submit({ p_items: [1] })).rejects.toThrow(/V3 database update/);
  await expect(submit({ p_items: [1] })).resolves.toEqual({ id: 'confirmed' });
  expect(rpc.mock.calls.every((call) => call[0] === 'place_qr_order_idempotent')).toBe(true);
  expect(rpc.mock.calls[0][1].p_idempotency_key).toBe(rpc.mock.calls[1][1].p_idempotency_key);
});
test('a deliberate identical repeat order has a fresh key when its cart identity changes', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { order: { id: 'one' } }, error: null });
  const submit = createOrderSubmitter({ rpc } as any, 'tenant');
  await submit({ p_items: [1] }, 'first-cart');
  await submit({ p_items: [1] }, 'second-cart');
  expect(rpc.mock.calls[0][1].p_idempotency_key).not.toBe(rpc.mock.calls[1][1].p_idempotency_key);
});
test('an uncertain request cannot silently be replaced by a changed cart', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'network unavailable' } });
  const submit = createOrderSubmitter({ rpc } as any, 'tenant');
  await expect(submit({ p_items: [1] }, 'first-cart')).rejects.toThrow('network unavailable');
  await expect(submit({ p_items: [2] }, 'second-cart')).rejects.toThrow(/still unconfirmed/);
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('tracking survives refresh but expires and is restaurant scoped', () => {
  const value = {
    id: 'order',
    token: 'secret-token',
    restaurantId: 'A',
    expiresAt: Date.now() + TRACKING_TTL,
  };
  saveTracking(value);
  expect(loadTracking('A')).toEqual(value);
  expect(loadTracking('B')).toBeNull();
  saveTracking({ ...value, expiresAt: Date.now() - 1 });
  expect(loadTracking('A')).toBeNull();
});
test('QR creation uses the persisted token and fails when QR persistence fails', async () => {
  let insertedToken = '';
  const from = vi.fn((table: string) => {
    const chain: any = {
      select: () => chain,
      single: () =>
        Promise.resolve(
          table === 'restaurant_tables'
            ? { data: { id: 'table' }, error: null }
            : { data: { table_id: 'table', public_token: insertedToken }, error: null },
        ),
      insert: (rows: any[]) => {
        if (table === 'table_qr_codes') insertedToken = rows[0].public_token;
        return chain;
      },
    };
    return chain;
  });
  const result = await createTableWithQr({ from } as any, { display_name: 'Table 1' });
  expect(result.qr.public_token).toBe(insertedToken);
  expect(insertedToken).toMatch(/^qr_/);
});
test('failed QR insert compensates the table write and never returns a fake token', async () => {
  let deleted = false;
  const from = vi.fn((table: string) => {
    const chain: any = {
      insert: () => chain,
      select: () => chain,
      single: () =>
        Promise.resolve(
          table === 'restaurant_tables'
            ? { data: { id: 'table' }, error: null }
            : { data: null, error: { message: 'denied' } },
        ),
      delete: () => {
        deleted = true;
        return chain;
      },
      eq: () => chain,
      then: (resolve: any) => resolve({ data: [{ id: 'table' }], error: null }),
    };
    return chain;
  });
  await expect(createTableWithQr({ from } as any, {})).rejects.toThrow(
    /QR creation failed.*rolled back/,
  );
  expect(deleted).toBe(true);
});
test('QR URLs explicitly select the customer route and staff URLs ignore incidental table params', () => {
  const url = new URL(qrUrl('qr_a token', 'https://dine.example'));
  expect(url.searchParams.get('table')).toBe('qr_a token');
  expect(url.searchParams.get('view')).toBe('customer');
  expect(getViewMode('?view=pos&table=other')).toBe('pos');
  expect(getViewMode('?table=qr')).toBe('customer');
});
test('checkout rounds taxes and service charges independently without an invisible tip', () => {
  expect(orderTotals(100, 8, 5)).toEqual({
    subtotal: 100,
    taxAmount: 8,
    serviceCharge: 5,
    tipAmount: 0,
    grandTotal: 113,
  });
  expect(orderTotals(0.05, 8, 5).grandTotal).toBe(0.05);
});
