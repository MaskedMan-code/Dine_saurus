import type { SupabaseClient } from '@supabase/supabase-js';
import { readJson, writeStorage } from './storage';
export const TRACKING_TTL = 24 * 60 * 60 * 1000;
export function validateGuest(name: string, phone: string): string | null {
  if (name.trim().length < 2 || name.trim().length > 120)
    return 'Enter your full name (2–120 characters).';
  if (
    !/^\+?[0-9 ()-]{7,24}$/.test(phone.trim()) ||
    phone.replace(/\D/g, '').length < 7 ||
    phone.replace(/\D/g, '').length > 15
  )
    return 'Enter a valid mobile number, including the country code.';
  return null;
}
export interface TrackingRecord {
  id: string;
  token: string;
  restaurantId: string;
  expiresAt: number;
}
export function loadTracking(restaurantId: string): TrackingRecord | null {
  const key = `dinesaurus:tracking:${restaurantId}`;
  const value = readJson<TrackingRecord | null>(key, null);
  if (
    !value ||
    value.restaurantId !== restaurantId ||
    !value.id ||
    !value.token ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt <= Date.now()
  ) {
    writeStorage(key, null, 'session');
    return null;
  }
  return value;
}
export function saveTracking(value: TrackingRecord) {
  writeStorage(`dinesaurus:tracking:${value.restaurantId}`, JSON.stringify(value), 'session');
}
export function createOrderSubmitter(client: SupabaseClient, scope: string) {
  let pending: Promise<any> | null = null;
  return (payload: Record<string, unknown>, cartIdentity = ''): Promise<any> => {
    if (pending) return pending;
    pending = (async () => {
      const signature = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(JSON.stringify([payload, cartIdentity])),
          ),
        ),
      )
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      const key = `dinesaurus:order-intent:${scope}`;
      const previous = readJson<{
        signature: string;
        id: string;
        expiresAt: number;
        status?: string;
      } | null>(key, null);
      if (
        previous?.status === 'pending' &&
        previous.signature !== signature &&
        previous.expiresAt > Date.now()
      )
        throw new Error(
          'An earlier order request is still unconfirmed. Retry the original cart or ask staff to check it before placing a different order.',
        );
      const intent =
        previous?.signature === signature && previous.expiresAt > Date.now()
          ? previous
          : {
              signature,
              id: crypto.randomUUID(),
              expiresAt: Date.now() + TRACKING_TTL,
              status: 'pending',
            };
      writeStorage(key, JSON.stringify(intent), 'session');
      const { data, error } = await client.rpc('place_qr_order_idempotent', {
        ...payload,
        p_idempotency_key: intent.id,
      });
      if (error || !data?.order) {
        if (error?.code && !['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003'].includes(error.code))
          writeStorage(key, JSON.stringify({ ...intent, status: 'rejected' }), 'session');
        if (error?.code === 'PGRST202')
          throw new Error(
            'Ordering is awaiting the V3 database update. Please ask the restaurant to take your order.',
          );
        throw new Error(
          error?.message ||
            'The server could not confirm your order. Your cart is saved; retry to check this request.',
        );
      }
      writeStorage(key, JSON.stringify({ ...intent, status: 'confirmed' }), 'session');
      // Cart line identities distinguish a deliberate repeat order from a network retry.
      return data.order;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
