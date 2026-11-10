import { supabase } from './supabase';
import { readJson, writeStorage } from './storage';
export async function pilotRpc<T = any>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
  if (error)
    throw Object.assign(
      new Error(
        error.code === 'PGRST202'
          ? 'V3.1 database setup is not deployed. Ask your administrator to apply the reviewed migrations.'
          : error.message,
      ),
      { code: error.code },
    );
  return data as T;
}
export async function pilotAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('pilot-admin', { body, timeout: 30000 });
  if (error) {
    let message =
      'Provisioning was not confirmed. Retry the same request or ask your administrator.';
    try {
      const result = await error.context?.json();
      if (typeof result?.error === 'string') message = result.error;
    } catch {
      /* Keep the safe fallback. */
    }
    throw Object.assign(new Error(message), { status: error.context?.status });
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function submitProvision(
  scope: string,
  action: string,
  payload: Record<string, unknown>,
) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([action, payload])),
  );
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  const key = `dinesaurus:provision:${scope}`;
  const old = readJson<{ id: string; hash: string } | null>(key, null);
  if (old && old.hash !== hash)
    throw new Error(
      'An earlier provisioning request is unconfirmed. Retry its original details before starting another account.',
    );
  const intent = old || { id: crypto.randomUUID(), hash };
  writeStorage(key, JSON.stringify(intent), 'session');
  try {
    const result = await pilotAdmin({ action, request_id: intent.id, payload });
    writeStorage(key, null, 'session');
    return result;
  } catch (e) {
    if (
      (e as { status?: number }).status &&
      [400, 403, 409].includes((e as { status: number }).status)
    )
      writeStorage(key, null, 'session');
    throw e;
  }
}
export async function submitPilotWrite<T>(
  scope: string,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([name, args])),
  );
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  const key = `dinesaurus:pilot-write:${scope}`;
  const old = readJson<{ id: string; hash: string } | null>(key, null);
  if (old && old.hash !== hash)
    throw new Error(
      'A previous request is unconfirmed. Retry the original details before changing the transaction.',
    );
  const intent = old || { id: crypto.randomUUID(), hash };
  writeStorage(key, JSON.stringify(intent), 'session');
  try {
    const result = await pilotRpc<T>(name, { ...args, p_request_id: intent.id });
    writeStorage(key, null, 'session');
    return result;
  } catch (e) {
    // Transport uncertainty retains the key. A confirmed SQL rejection created no ledger row.
    if (
      ['P0001', '23505', '23503', '23514', '42501', '22P02', '22023', 'PGRST202'].includes(
        (e as { code: string }).code,
      )
    )
      writeStorage(key, null, 'session');
    throw e;
  }
}
