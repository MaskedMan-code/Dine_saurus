import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useRouteView } from '../lib/route';
import { readStorage, writeStorage } from '../lib/storage';
import { diagnostic } from '../lib/diagnostics';

export interface TenantRestaurant {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
}
export interface TenantLocation {
  id: string;
  restaurantId: string;
  name: string;
}
type TenantSource = 'staff-org' | 'qr-token' | 'restaurant-slug' | 'none';
interface TenantState {
  key: string;
  source: TenantSource;
  organizationId: string | null;
  restaurants: TenantRestaurant[];
  activeRestaurantId: string | null;
  activeLocationId: string | null;
  locations: TenantLocation[];
  resolvedTableId: string | null;
  publicTableToken: string | null;
}
interface TenantContextType extends Omit<TenantState, 'key' | 'locations'> {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  needsOnboarding: boolean;
  setActiveRestaurantId: (id: string) => void;
  setActiveLocationId: (id: string) => void;
  retry: () => void;
}
const empty: TenantState = {
  key: '',
  source: 'none',
  organizationId: null,
  restaurants: [],
  locations: [],
  activeRestaurantId: null,
  activeLocationId: null,
  resolvedTableId: null,
  publicTableToken: null,
};
const TenantContext = createContext<TenantContextType | undefined>(undefined);
const mapRestaurant = (r: any): TenantRestaurant => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  slug: r.slug,
  status: r.status,
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authLoading, profileLoading, user, staff, isStaff } = useAuth();
  const { viewMode, search } = useRouteView();
  const publicRoute = viewMode === 'customer';
  const params = new URLSearchParams(search);
  const slug = publicRoute ? params.get('restaurant') : null;
  // Explicit links always beat saved hints. Staff URLs never consume QR hints.
  const token = publicRoute
    ? (params.get('table') ?? (!slug ? readStorage('dinesaurus:lastTableToken', 'session') : null))
    : null;
  const staffOrg = !publicRoute && isStaff ? (staff?.organizationId ?? null) : null;
  const key = publicRoute
    ? `public:${token ?? ''}:${slug ?? ''}`
    : `staff:${user?.id ?? ''}:${staffOrg ?? ''}`;
  const [state, setState] = useState<TenantState>(empty);
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [selection, setSelection] = useState<{ org: string; id: string } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const waitingForAuth = !publicRoute && (authLoading || (!!user && profileLoading && !staff));
  const chosenId = selection?.org === staffOrg ? selection?.id : null;

  useEffect(() => {
    if (waitingForAuth) return;
    const controller = new AbortController();
    setBusy(true);
    setFailure(null);
    diagnostic('tenant-resolve', { source: publicRoute ? (token ? 'qr' : 'slug') : 'staff' });
    void (async () => {
      try {
        let next: TenantState = { ...empty, key };
        if (publicRoute && token) {
          const { data, error } = await supabase
            .rpc('resolve_qr_context', { p_public_token: token })
            .abortSignal(controller.signal);
          if (error) throw new Error(error.message);
          const row = Array.isArray(data) ? data[0] : data;
          if (!row?.restaurant_id || !row?.table_id || !row?.public_token)
            throw new Error(
              'This QR code is invalid or revoked. Please ask the restaurant for a current QR code.',
            );
          next = {
            ...next,
            source: 'qr-token',
            organizationId: row.organization_id,
            activeRestaurantId: row.restaurant_id,
            activeLocationId: row.location_id,
            resolvedTableId: row.table_id,
            publicTableToken: row.public_token,
            restaurants: [
              {
                id: row.restaurant_id,
                organizationId: row.organization_id,
                name: row.restaurant_name,
                slug: row.restaurant_slug,
                status: 'active',
              },
            ],
          };
        } else if (publicRoute && slug) {
          const { data, error } = await supabase
            .from('restaurants')
            .select('id,organization_id,name,slug,status')
            .eq('slug', slug)
            .eq('status', 'active')
            .abortSignal(controller.signal)
            .single();
          if (error || !data)
            throw new Error('This restaurant link is unavailable. Please scan a current table QR.');
          next = {
            ...next,
            source: 'restaurant-slug',
            organizationId: data.organization_id,
            restaurants: [mapRestaurant(data)],
            activeRestaurantId: data.id,
          };
        } else if (!publicRoute && staffOrg) {
          const { data, error } = await supabase
            .from('restaurants')
            .select('id,organization_id,name,slug,status')
            .eq('organization_id', staffOrg)
            .order('id')
            .abortSignal(controller.signal);
          if (error) throw new Error(error.message);
          const restaurants = (data ?? []).map(mapRestaurant);
          const selected = chosenId ?? readStorage(`dinesaurus:restaurant:${staffOrg}`);
          next = {
            ...next,
            source: 'staff-org',
            organizationId: staffOrg,
            restaurants,
            activeRestaurantId:
              (restaurants.find((r) => r.id === selected) ?? restaurants[0])?.id ?? null,
          };
        }
        if (next.activeRestaurantId) {
          const { data, error } = await supabase
            .from('restaurant_locations')
            .select('id,restaurant_id,name')
            .eq('restaurant_id', next.activeRestaurantId)
            .eq('active', true)
            .order('id')
            .abortSignal(controller.signal);
          if (error) throw new Error(error.message);
          next.locations = (data ?? []).map((l) => ({
            id: l.id,
            restaurantId: l.restaurant_id,
            name: l.name,
          }));
          const previous =
            stateRef.current.key === key &&
            stateRef.current.activeRestaurantId === next.activeRestaurantId
              ? stateRef.current.activeLocationId
              : null;
          const saved = previous ?? readStorage(`dinesaurus:location:${next.activeRestaurantId}`);
          next.activeLocationId =
            next.activeLocationId ??
            (next.locations.find((l) => l.id === saved) ?? next.locations[0])?.id ??
            null;
        }
        if (controller.signal.aborted) return;
        if (next.publicTableToken)
          writeStorage('dinesaurus:lastTableToken', next.publicTableToken, 'session');
        else if (publicRoute) writeStorage('dinesaurus:lastTableToken', null, 'session');
        setState(next);
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ ...empty, key });
          setFailure({
            key,
            message: error instanceof Error ? error.message : 'Could not resolve this restaurant.',
          });
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [key, publicRoute, token, slug, staffOrg, chosenId, tick, waitingForAuth]);

  // Hide the previous tenant synchronously, before effects or requests can finish.
  const current =
    state.key === key && (!chosenId || state.activeRestaurantId === chosenId)
      ? state
      : { ...empty, key };
  const setActiveRestaurantId = useCallback(
    (id: string) => {
      if (!staffOrg || !stateRef.current.restaurants.some((r) => r.id === id)) return;
      writeStorage(`dinesaurus:restaurant:${staffOrg}`, id);
      setSelection({ org: staffOrg, id });
    },
    [staffOrg],
  );
  const setActiveLocationId = useCallback(
    (id: string) => {
      if (publicRoute || !stateRef.current.locations.some((l) => l.id === id)) return;
      writeStorage(`dinesaurus:location:${stateRef.current.activeRestaurantId}`, id);
      setState((s) => ({ ...s, activeLocationId: id }));
    },
    [publicRoute],
  );
  const retry = useCallback(() => setTick((t) => t + 1), []);
  const loading =
    waitingForAuth ||
    ((busy || state.key !== key || current !== state) && !current.activeRestaurantId);
  const error = failure?.key === key ? failure.message : null;
  return (
    <TenantContext.Provider
      value={{
        ...current,
        loading,
        refreshing: busy && !!current.activeRestaurantId,
        error,
        needsOnboarding:
          !publicRoute &&
          !!staffOrg &&
          !loading &&
          !error &&
          current.source === 'staff-org' &&
          current.restaurants.length === 0,
        setActiveRestaurantId,
        setActiveLocationId,
        retry,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}
