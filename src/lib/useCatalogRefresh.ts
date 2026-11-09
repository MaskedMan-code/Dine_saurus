import { useEffect } from 'react';
import { supabase } from './supabase';

/** Public menus need both events and a fallback: deletes/unpublished rows can lose RLS visibility. */
export function useCatalogRefresh(
  restaurantId: string | null,
  locationId: string | null,
  enabled: boolean,
  refresh: () => void,
) {
  useEffect(() => {
    if (!enabled || !restaurantId || !locationId) return;
    let disposed = false;
    let debounce: number | undefined;
    const schedule = () => {
      if (disposed || document.hidden || debounce !== undefined) return;
      debounce = window.setTimeout(() => {
        debounce = undefined;
        if (!disposed) refresh();
      }, 150);
    };
    let channel = supabase.channel(`catalog-${restaurantId}-${locationId}`);
    for (const table of ['menu_items', 'menu_categories', 'modifier_groups']) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `restaurant_id=eq.${restaurantId}` },
        schedule,
      );
    }
    channel = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_item_location_settings',
          filter: `location_id=eq.${locationId}`,
        },
        schedule,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}` },
        schedule,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') schedule();
      });
    const interval = window.setInterval(schedule, 15000);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      disposed = true;
      window.clearTimeout(debounce);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', schedule);
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, locationId, enabled, refresh]);
}
