import type { SupabaseClient } from '@supabase/supabase-js';

/** Stock belongs to a location; omitted availability/price fields must keep their saved values. */
export async function saveMenuStock(
  client: SupabaseClient,
  itemId: string,
  locationId: string,
  soldOut: boolean,
) {
  if (!locationId) throw new Error('Select a location before updating stock.');
  const { data, error } = await client
    .from('menu_item_location_settings')
    .upsert(
      { menu_item_id: itemId, location_id: locationId, sold_out: soldOut },
      { onConflict: 'menu_item_id,location_id' },
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Stock availability was not saved.');
  return data;
}
