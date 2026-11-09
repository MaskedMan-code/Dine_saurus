import type { SupabaseClient } from '@supabase/supabase-js';
export async function createTableWithQr(client: SupabaseClient, payload: Record<string, unknown>) {
  const token = `qr_${crypto.randomUUID()}`;
  const { data: table, error } = await client
    .from('restaurant_tables')
    .insert([payload])
    .select()
    .single();
  if (error || !table) throw new Error(error?.message || 'The table was not saved.');
  const { data: qr, error: qrError } = await client
    .from('table_qr_codes')
    .insert([{ table_id: table.id, public_token: token, status: 'active' }])
    .select()
    .single();
  if (qrError || !qr?.public_token) {
    // Compensate a failed second write. Never invent a success token in local state.
    const cleanup = await client.from('restaurant_tables').delete().eq('id', table.id).select('id');
    throw new Error(
      `QR creation failed: ${qrError?.message || 'no persisted token returned'}.${cleanup.error || !cleanup.data?.length ? ' The table may exist without a QR; reload before retrying.' : ' The new table was rolled back.'}`,
    );
  }
  return { table, qr };
}
