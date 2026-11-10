import React from 'react';
import { webcrypto } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { submitPilotWrite, submitProvision } from '../src/lib/pilot';
import { ReceiptDocument, printStyles, formatMoney } from '../src/components/billing/PrintDocument';
import type { Bill } from '../src/types/pilot';
import { locationHours } from '../src/lib/hours';
import { brandColors } from '../src/lib/branding';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => ({ abortSignal: () => mock.rpc(...args) }),
    functions: { invoke: (...args: unknown[]) => mock.invoke(...args) },
  },
}));
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.rpc.mockReset();
  mock.invoke.mockReset();
});
test('uncertain payment retries retain the same key across refresh and reject changed amounts', async () => {
  mock.rpc
    .mockResolvedValueOnce({ data: null, error: { code: '', message: 'Failed to fetch' } })
    .mockResolvedValue({ data: { id: 'bill', paid: 50 }, error: null });
  const args = { p_bill_id: 'bill', p_amount: 50 };
  await expect(submitPilotWrite('cashier:bill', 'pilot_record_payment', args)).rejects.toThrow(
    /fetch/,
  );
  await expect(
    submitPilotWrite('cashier:bill', 'pilot_record_payment', { ...args, p_amount: 60 }),
  ).rejects.toThrow(/unconfirmed/);
  await submitPilotWrite('cashier:bill', 'pilot_record_payment', args);
  expect(mock.rpc.mock.calls[0][1].p_request_id).toBe(mock.rpc.mock.calls[1][1].p_request_id);
  expect(sessionStorage.getItem('dinesaurus:pilot-write:cashier:bill')).toBeNull();
});
test('provisioning stores only its fingerprint and retry key, never the credential or contact details', async () => {
  mock.invoke
    .mockResolvedValueOnce({
      data: null,
      error: {
        context: new Response(JSON.stringify({ error: 'Auth creation uncertain' }), {
          status: 503,
        }),
      },
    })
    .mockResolvedValue({
      data: { stage: 'completed', temporary_password: 'not-persisted' },
      error: null,
    });
  const payload = {
    email: 'private@example.test',
    display_name: 'Private Name',
    email_verified: true,
  };
  await expect(submitProvision('owner', 'staff', payload)).rejects.toThrow(/uncertain/);
  const stored = sessionStorage.getItem('dinesaurus:provision:owner')!;
  expect(stored).not.toContain(payload.email);
  expect(stored).not.toContain(payload.display_name);
  await submitProvision('owner', 'staff', payload);
  expect(mock.invoke.mock.calls[0][1].body.request_id).toBe(
    mock.invoke.mock.calls[1][1].body.request_id,
  );
  expect(sessionStorage.getItem('dinesaurus:provision:owner')).toBeNull();
});
test('receipts escape customer/menu text, disclose offline payment recording and support 58/80/A4', () => {
  const bill = {
    receipt_number: 'R-1',
    currency: 'INR',
    created_at: '2026-11-10T10:00:00Z',
    state: 'issued',
    payment_status: 'pending',
    subtotal: 100,
    discount: 10,
    tax: 0,
    service_charge: 0,
    tip: 0,
    total: 90,
    paid: 0,
    balance: 90,
    payments: [],
    snapshot: {
      brand: { name: '<script>alert(1)</script>', timezone: 'Asia/Kolkata' },
      orders: [
        {
          id: 'order',
          number: 'ORD-1',
          mode: 'dine_in',
          items: [
            {
              name: '<img src=x onerror=alert(1)>',
              unit_price: 100,
              quantity: 1,
              total: 100,
              modifiers: [],
            },
          ],
        },
      ],
    },
  } as unknown as Bill;
  const html = renderToStaticMarkup(<ReceiptDocument bill={bill} />);
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('not a verified tax invoice');
  expect(html).toContain('No payment recorded');
  expect(formatMoney(90, 'INR')).toContain('90.00');
  expect(printStyles('58')).toContain('size:58mm 297mm');
  expect(printStyles('80')).toContain('size:80mm 297mm');
  expect(printStyles('A4')).toContain('size:A4');
});
test('hours respect the location date/timezone and holidays without inventing an open schedule', () => {
  const hours = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [
      String(i),
      { closed: false, open: '09:00', close: '21:00' },
    ]),
  );
  expect(locationHours(null, [], 'Asia/Kolkata').open).toBeNull();
  expect(locationHours(hours, [], 'Asia/Kolkata', new Date('2026-11-10T10:00:00Z')).open).toBe(
    true,
  );
  expect(locationHours(hours, [], 'Asia/Kolkata', new Date('2026-11-10T23:00:00Z')).open).toBe(
    false,
  );
  expect(
    locationHours(null, ['2026-11-11'], 'Asia/Kolkata', new Date('2026-11-10T23:00:00Z')).label,
  ).toContain('holiday');
  expect(brandColors('#ffffff').color).toBe('#000000');
  expect(brandColors('#000000').color).toBe('#ffffff');
  expect(brandColors('javascript:alert(1)').backgroundColor).toBe('#16342b');
});
