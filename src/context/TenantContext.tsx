import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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

interface ResolvedTable {
  tableId: string;
  locationId: string;
  restaurantId: string;
  organizationId: string;
  publicToken: string;
}

type TenantSource = 'staff-org' | 'qr-token' | 'restaurant-slug' | 'none';

interface TenantContextType {
  loading: boolean;
  error: string | null;
  source: TenantSource;

  // Resolved identity
  organizationId: string | null;
  restaurants: TenantRestaurant[]; // restaurants belonging to the resolved org (staff) or the single resolved one (guest)
  activeRestaurantId: string | null;
  setActiveRestaurantId: (id: string) => void;
  activeLocationId: string | null;
  setActiveLocationId: (id: string) => void;
  resolvedTableId: string | null; // set only when a guest arrived via a table QR link
  publicTableToken: string | null;

  needsOnboarding: boolean; // staff, active, but their org owns zero restaurants
  retry: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const LAST_RESTAURANT_KEY = 'dinesaurus:lastRestaurantId';
const LAST_LOCATION_KEY = 'dinesaurus:lastLocationId';
const LAST_TABLE_TOKEN_KEY = 'dinesaurus:lastTableToken';

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading: authLoading, isStaff, staff, isCustomer, customer } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<TenantSource>('none');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<TenantRestaurant[]>([]);
  const [activeRestaurantId, setActiveRestaurantIdState] = useState<string | null>(null);
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(null);
  const [resolvedTableId, setResolvedTableId] = useState<string | null>(null);
  const [publicTableToken, setPublicTableToken] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const setActiveRestaurantId = useCallback((id: string) => {
    setActiveRestaurantIdState(id);
    try { localStorage.setItem(LAST_RESTAURANT_KEY, id); } catch { /* ignore */ }
  }, []);

  const setActiveLocationId = useCallback((id: string) => {
    setActiveLocationIdState(id);
    try { localStorage.setItem(LAST_LOCATION_KEY, id); } catch { /* ignore */ }
  }, []);

  const retry = useCallback(() => setRefreshTick(t => t + 1), []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setError(null);

      try {
        // ---------- PATH 1: signed-in staff member -> resolve by organization_members, never guess ----------
        if (isStaff && staff) {
          setSource('staff-org');
          setOrganizationId(staff.organizationId);

          const { data: restRows, error: restErr } = await supabase
            .from('restaurants')
            .select('id, organization_id, name, slug, status')
            .eq('organization_id', staff.organizationId);

          if (restErr) throw new Error(restErr.message);
          if (cancelled) return;

          const mapped: TenantRestaurant[] = (restRows || []).map((r: any) => ({
            id: r.id, organizationId: r.organization_id, name: r.name, slug: r.slug, status: r.status,
          }));
          setRestaurants(mapped);

          if (mapped.length === 0) {
            setActiveRestaurantIdState(null);
            setActiveLocationIdState(null);
            setLoading(false);
            return;
          }

          let lastRestId: string | null = null;
          try { lastRestId = localStorage.getItem(LAST_RESTAURANT_KEY); } catch { /* ignore */ }
          const chosen = mapped.find(r => r.id === lastRestId) || mapped[0];
          setActiveRestaurantIdState(chosen.id);

          const { data: locRows, error: locErr } = await supabase
            .from('restaurant_locations')
            .select('id, restaurant_id, name')
            .eq('restaurant_id', chosen.id);
          if (locErr) throw new Error(locErr.message);
          if (cancelled) return;

          let lastLocId: string | null = null;
          try { lastLocId = localStorage.getItem(LAST_LOCATION_KEY); } catch { /* ignore */ }
          const chosenLoc = (locRows || []).find((l: any) => l.id === lastLocId) || locRows?.[0];
          setActiveLocationIdState(chosenLoc?.id || null);

          setLoading(false);
          return;
        }

        // ---------- PATH 2: guest / customer arriving via a table QR link ----------
        const params = new URLSearchParams(window.location.search);
        let tableToken = params.get('table');
        if (!tableToken) {
          try { tableToken = localStorage.getItem(LAST_TABLE_TOKEN_KEY); } catch { /* ignore */ }
        }

        if (tableToken) {
          const { data: qrRows, error: qrErr } = await supabase.rpc('resolve_qr_context', { p_public_token: tableToken });
          if (qrErr) throw new Error(qrErr.message);
          const qrRow: any = Array.isArray(qrRows) ? qrRows[0] : qrRows;

          if (qrRow) {
            if (cancelled) return;
            try { localStorage.setItem(LAST_TABLE_TOKEN_KEY, tableToken); } catch { /* ignore */ }
            setSource('qr-token');
            setOrganizationId(qrRow.organization_id);
            setRestaurants([{ id: qrRow.restaurant_id, organizationId: qrRow.organization_id, name: qrRow.restaurant_name, slug: qrRow.restaurant_slug, status: 'active' }]);
            setActiveRestaurantIdState(qrRow.restaurant_id);
            setActiveLocationIdState(qrRow.location_id);
            setResolvedTableId(qrRow.table_id);
            setPublicTableToken(qrRow.public_token);
            setLoading(false);
            return;
          }
          // stale/invalid token: fall through to slug/demo resolution below
        }

        // ---------- PATH 3: guest arriving via a restaurant slug (?restaurant=slug) ----------
        const slug = params.get('restaurant');
        if (slug) {
          const { data: restRow, error: restErr } = await supabase
            .from('restaurants')
            .select('id, organization_id, name, slug, status')
            .eq('slug', slug)
            .eq('status', 'active')
            .maybeSingle();
          if (restErr) throw new Error(restErr.message);
          if (restRow) {
            if (cancelled) return;
            setSource('restaurant-slug');
            setOrganizationId(restRow.organization_id);
            setRestaurants([{ id: restRow.id, organizationId: restRow.organization_id, name: restRow.name, slug: restRow.slug, status: restRow.status }]);
            setActiveRestaurantIdState(restRow.id);

            const { data: locRows } = await supabase.from('restaurant_locations').select('id').eq('restaurant_id', restRow.id).limit(1);
            setActiveLocationIdState(locRows?.[0]?.id || null);
            setResolvedTableId(null);
            setPublicTableToken(null);
            setLoading(false);
            return;
          }
        }

        // ---------- PATH 4: nothing resolvable — this is a genuine empty state, not a guess ----------
        setSource('none');
        setOrganizationId(null);
        setRestaurants([]);
        setActiveRestaurantIdState(null);
        setActiveLocationIdState(null);
        setResolvedTableId(null);
        setPublicTableToken(null);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to resolve restaurant context');
          setLoading(false);
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [authLoading, isStaff, staff, isCustomer, customer, refreshTick]);

  const needsOnboarding = !!(isStaff && staff?.isActive && !loading && !error && restaurants.length === 0 && source === 'staff-org');

  return (
    <TenantContext.Provider
      value={{
        loading, error, source,
        organizationId, restaurants,
        activeRestaurantId, setActiveRestaurantId,
        activeLocationId, setActiveLocationId,
        resolvedTableId, publicTableToken,
        needsOnboarding,
        retry,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
};
