import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Restaurant,
  MenuCategory,
  MenuItem,
  RestaurantArea,
  RestaurantTable,
  Order,
  CartItem,
  ServiceRequest,
  CustomerProfile,
  Review,
  SaaSPlan,
  FeatureFlags,
  OrderStatus,
  OrderMode,
  SelectedModifier,
} from '../types';
import { SAAS_PLANS, DEFAULT_FEATURE_FLAGS } from '../data/seedData';
import { supabase } from '../lib/supabase';
import { useRouteView, navigateView } from '../lib/route';
import { readJson, writeStorage } from '../lib/storage';
import {
  createOrderSubmitter,
  loadTracking,
  saveTracking,
  TRACKING_TTL,
  validateGuest,
} from '../lib/ordering';
import { createTableWithQr } from '../lib/tables';
import { diagnostic } from '../lib/diagnostics';
import { orderTotals } from '../lib/money';
import { saveMenuStock } from '../lib/menuStock';
import { useCatalogRefresh } from '../lib/useCatalogRefresh';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import {
  mapRestaurant,
  mapArea,
  mapTable,
  mapCategory,
  mapMenuItem,
  mapModifierGroup,
  mapOrder,
  mapServiceRequest,
  mapReview,
} from '../lib/mappers';

export type AppViewMode =
  | 'customer'
  | 'pos'
  | 'kds'
  | 'tables'
  | 'menu'
  | 'service_desk'
  | 'analytics'
  | 'loyalty_admin'
  | 'settings'
  | 'admin_users';

interface RestaurantContextType {
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;
  restaurant: Restaurant | null;
  activeLocationId: string;
  setActiveLocationId: (locId: string) => void;
  activeTable: RestaurantTable | null;
  setActiveTable: (table: RestaurantTable | null) => void;
  dataLoading: boolean;
  dataError: string | null;
  dataRefreshing: boolean;
  mutationError: string | null;
  dismissMutationError: () => void;
  trackingError: string | null;
  retryLoad: () => void;

  categories: MenuCategory[];
  menuItems: MenuItem[];
  selectedCategory: string;
  setSelectedCategory: (catId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dietaryFilters: { vegetarian: boolean; vegan: boolean; glutenFree: boolean };
  setDietaryFilters: React.Dispatch<
    React.SetStateAction<{ vegetarian: boolean; vegan: boolean; glutenFree: boolean }>
  >;
  toggleItemSoldOut: (itemId: string) => Promise<boolean>;
  saveMenuItem: (item: MenuItem) => Promise<boolean>;
  deleteMenuItem: (itemId: string) => Promise<boolean>;
  saveCategory: (category: MenuCategory) => Promise<boolean>;

  areas: RestaurantArea[];
  tables: RestaurantTable[];
  updateTableStatus: (tableId: string, status: RestaurantTable['status']) => Promise<boolean>;
  saveTable: (table: RestaurantTable) => Promise<boolean>;
  deleteTable: (tableId: string) => Promise<boolean>;

  cart: CartItem[];
  addToCart: (
    item: MenuItem,
    quantity: number,
    selectedModifiers: SelectedModifier[],
    specialInstructions?: string,
  ) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartTotalAmount: number;
  cartItemCount: number;

  orders: Order[];
  activeOrder: Order | null;
  setActiveOrder: (order: Order | null) => void;
  createOrder: (orderData: {
    orderMode: OrderMode;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: Order['paymentMethod'];
    tipAmount?: number;
    carDeliveryDetails?: Order['carDeliveryDetails'];
    specialNotes?: string;
    items?: CartItem[];
    tableId?: string;
  }) => Promise<Order>;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus, note?: string) => Promise<boolean>;

  serviceRequests: ServiceRequest[];
  createServiceRequest: (type: ServiceRequest['type'], customMessage?: string) => Promise<boolean>;
  updateServiceRequestStatus: (
    requestId: string,
    status: ServiceRequest['status'],
  ) => Promise<boolean>;

  customerProfile: CustomerProfile;
  redeemReward: (rewardId: string) => Promise<boolean>;
  addCustomerStamps: (stamps: number) => Promise<boolean>;

  reviews: Review[];
  submitReview: (rating: number, comment: string, tags?: string[]) => Promise<boolean>;
  replyToReview: (reviewId: string, replyText: string) => Promise<boolean>;

  currentPlan: SaaSPlan;
  setCurrentPlan: (plan: SaaSPlan) => void;
  featureFlags: FeatureFlags;
  toggleFeatureFlag: (flag: keyof FeatureFlags) => Promise<boolean>;
  updateRestaurantSettings: (updated: Partial<Restaurant>) => Promise<boolean>;

  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  playOrderChime: () => void;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

const EMPTY_PROFILE: CustomerProfile = {
  id: '',
  name: 'Guest',
  phone: '',
  email: '',
  pointsBalance: 0,
  stampsCount: 0,
  stampsRequired: 10,
  tier: 'Silver',
  joinedAt: new Date().toISOString(),
  totalOrdersCount: 0,
  savedRewards: [],
};

// A real tenant/route change is a privacy boundary; ordinary auth events retain the subtree.
export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurantId, activeLocationId, resolvedTableId, organizationId, source } =
    useTenant();
  const { user } = useAuth();
  const key = `${source}:${organizationId ?? ''}:${activeRestaurantId ?? ''}:${activeLocationId ?? ''}:${resolvedTableId ?? ''}:${source === 'staff-org' ? (user?.id ?? '') : 'guest'}`;
  return <RestaurantSession key={key}>{children}</RestaurantSession>;
};
const RestaurantSession: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customer, staff, isStaff, user, refreshProfile } = useAuth();
  const {
    activeRestaurantId,
    source,
    organizationId,
    activeLocationId: tenantLocationId,
    setActiveLocationId: setTenantLocationId,
    resolvedTableId,
    publicTableToken,
    loading: tenantLoading,
    error: tenantError,
  } = useTenant();

  const { viewMode } = useRouteView();
  const setViewMode = navigateView;
  const staffOrgId = source === 'staff-org' && isStaff ? (staff?.organizationId ?? null) : null;
  const scopedCustomer =
    source !== 'staff-org' && customer?.organizationId === organizationId ? customer : null;
  const scopedCustomerId = scopedCustomer?.id;
  const loadedCatalog = useRef(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [areas, setAreas] = useState<RestaurantArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [activeTable, setActiveTable] = useState<RestaurantTable | null>(null);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const uiKey = `dinesaurus:menu:${activeRestaurantId}:${tenantLocationId}`;
  const savedFilters = useMemo(() => readJson<any>(uiKey, {}), [uiKey]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    typeof savedFilters.category === 'string' ? savedFilters.category : '',
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    typeof savedFilters.search === 'string' ? savedFilters.search : '',
  );
  const [dietaryFilters, setDietaryFilters] = useState({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  });

  const cartKey = `dinesaurus:cart:${activeRestaurantId}:${tenantLocationId}:${resolvedTableId || 'none'}`;
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = readJson<unknown>(cartKey, []);
    return Array.isArray(saved)
      ? saved.filter(
          (c) =>
            c?.menuItem?.id &&
            typeof c.menuItem.name === 'string' &&
            Array.isArray(c.selectedModifiers) &&
            c.selectedModifiers.every(
              (m: any) => typeof m.optionId === 'string' && Number.isFinite(m.priceDelta),
            ) &&
            Number.isInteger(c.quantity) &&
            c.quantity > 0 &&
            Number.isFinite(c.totalPrice),
        )
      : [];
  });
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const initialTracking = useMemo(
    () => (activeRestaurantId ? loadTracking(activeRestaurantId) : null),
    [activeRestaurantId],
  );
  const [tracking, setTracking] = useState(initialTracking);
  useEffect(() => {
    writeStorage(cartKey, JSON.stringify(cart), 'session');
  }, [cartKey, cart]);
  useEffect(() => {
    writeStorage(
      uiKey,
      JSON.stringify({ category: selectedCategory, search: searchQuery }),
      'session',
    );
  }, [uiKey, selectedCategory, searchQuery]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [rewardRows, setRewardRows] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [currentPlan, setCurrentPlan] = useState<SaaSPlan>(SAAS_PLANS[0]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [dataRefreshing, setDataRefreshing] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const dismissMutationError = useCallback(() => setMutationError(null), []);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    diagnostic('restaurant-mount');
    return () => {
      aliveRef.current = false;
      diagnostic('restaurant-unmount');
    };
  }, []);
  const performWrite = async (write: () => Promise<void>): Promise<boolean> => {
    setMutationError(null);
    try {
      await write();
      return true;
    } catch (error) {
      if (aliveRef.current)
        setMutationError(
          error instanceof Error ? error.message : 'The update was not saved. Please retry.',
        );
      return false;
    }
  };
  const requireRow = (result: any) => {
    if (result.error) throw new Error(result.error.message);
    if (!result.data || (Array.isArray(result.data) && !result.data.length))
      throw new Error('No row was saved. Check your access and reload before retrying.');
    return result.data;
  };
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const catalogInFlight = useRef(false);
  const catalogRefreshQueued = useRef(false);
  const retryLoad = useCallback(() => {
    if (catalogInFlight.current) {
      catalogRefreshQueued.current = true;
      return;
    }
    setReloadTick((t) => t + 1);
  }, []);
  useCatalogRefresh(
    activeRestaurantId,
    tenantLocationId,
    source !== 'staff-org' && !tenantLoading,
    retryLoad,
  );

  const tablesRef = useRef<RestaurantTable[]>([]);
  const areasRef = useRef<RestaurantArea[]>([]);
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);
  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  const lookupTableInfo = useCallback((tableId?: string) => {
    if (!tableId) return { tableNumber: undefined, areaName: undefined };
    const t = tablesRef.current.find((x) => x.id === tableId);
    const a = t ? areasRef.current.find((x) => x.id === t.areaId) : undefined;
    return { tableNumber: t?.tableNumber, areaName: a?.name };
  }, []);

  // ============ CATALOG LOAD — scoped to the tenant-resolved restaurant, never a global .limit(1) ============
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (tenantLoading) return;
      if (tenantError) {
        setDataError(tenantError);
        setDataLoading(false);
        return;
      }
      if (!activeRestaurantId) {
        // Genuine empty state: no tenant resolved (new staff needing onboarding, or no QR/slug context).
        setRestaurant(null);
        setDataLoading(false);
        setDataError(null);
        return;
      }

      catalogInFlight.current = true;
      setDataLoading(!loadedCatalog.current);
      setDataRefreshing(loadedCatalog.current);
      setDataError(null);
      try {
        const { data: rest, error: restErr } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', activeRestaurantId)
          .single();
        if (restErr) throw new Error(restErr.message);
        if (cancelled) return;

        const { data: locs, error: locErr } = await supabase
          .from('restaurant_locations')
          .select('*')
          .eq('restaurant_id', rest.id);
        if (locErr) throw new Error(locErr.message);
        if (cancelled) return;

        const mappedRestaurant = mapRestaurant(rest, locs || []);
        setRestaurant(mappedRestaurant);

        const effectiveLocationId = tenantLocationId || mappedRestaurant.locations[0]?.id;
        if (effectiveLocationId && effectiveLocationId !== tenantLocationId) {
          setTenantLocationId(effectiveLocationId);
        }

        const locationIds = (locs || []).map((l: any) => l.id);
        const placeholderId = '00000000-0000-0000-0000-000000000000';

        const [
          { data: areaRows, error: areaErr },
          { data: tableRows, error: tableErr },
          { data: catRows, error: catErr },
          { data: itemRows, error: itemErr },
          { data: groupRows, error: groupErr },
        ] = await Promise.all([
          supabase
            .from('restaurant_areas')
            .select('*')
            .in('location_id', locationIds.length ? locationIds : [placeholderId]),
          supabase
            .from('restaurant_tables')
            .select('*')
            .in('location_id', locationIds.length ? locationIds : [placeholderId]),
          supabase
            .from('menu_categories')
            .select('*')
            .eq('restaurant_id', rest.id)
            .order('sort_order'),
          supabase.from('menu_items').select('*').eq('restaurant_id', rest.id),
          supabase.from('modifier_groups').select('*').eq('restaurant_id', rest.id),
        ]);
        const firstErr = areaErr || tableErr || catErr || itemErr || groupErr;
        if (firstErr) throw new Error(firstErr.message);
        if (cancelled) return;

        const tableIds = (tableRows || []).map((t: any) => t.id);
        const groupIds = (groupRows || []).map((g: any) => g.id);
        const effectiveLocation = tenantLocationId || locationIds[0];
        const [
          { data: qrRows, error: qrErr },
          { data: optionRows, error: optionErr },
          { data: junctionRows, error: junctionErr },
          { data: locationSettingsRows, error: settingsErr },
        ] = await Promise.all([
          staffOrgId && tableIds.length
            ? supabase.from('table_qr_codes').select('*').in('table_id', tableIds)
            : Promise.resolve({ data: [] as any[], error: null }),
          groupIds.length
            ? supabase.from('modifier_options').select('*').in('modifier_group_id', groupIds)
            : Promise.resolve({ data: [] as any[], error: null }),
          supabase
            .from('menu_item_modifier_groups')
            .select('*')
            .in('modifier_group_id', groupIds.length ? groupIds : [placeholderId]),
          effectiveLocation
            ? supabase
                .from('menu_item_location_settings')
                .select('*')
                .eq('location_id', effectiveLocation)
            : Promise.resolve({ data: [] as any[], error: null as any }),
        ]);
        if (settingsErr || qrErr || optionErr || junctionErr)
          throw new Error((settingsErr || qrErr || optionErr || junctionErr)!.message);

        if (cancelled) return;

        setAreas(
          (areaRows || []).filter((a: any) => a.location_id === effectiveLocation).map(mapArea),
        );
        setTables(
          (tableRows || [])
            .filter((t: any) => t.location_id === effectiveLocation)
            .map((t: any) =>
              mapTable(
                t,
                (qrRows || []).find((q: any) => q.table_id === t.id && q.status === 'active') ??
                  (t.id === resolvedTableId ? { public_token: publicTableToken } : undefined),
              ),
            ),
        );
        const visibleCategories = (catRows || []).filter((row: any) => staffOrgId || row.active);
        setCategories(visibleCategories.map(mapCategory));
        setSelectedCategory((prev) =>
          visibleCategories.some((row: any) => row.id === prev)
            ? prev
            : visibleCategories[0]?.id || '',
        );

        const optionsByGroup = (optionRows || []).reduce((acc: any, o: any) => {
          (acc[o.modifier_group_id] = acc[o.modifier_group_id] || []).push(o);
          return acc;
        }, {});
        const groupsByItem = (junctionRows || []).reduce((acc: any, j: any) => {
          const group = (groupRows || []).find((g: any) => g.id === j.modifier_group_id);
          if (!group) return acc;
          (acc[j.menu_item_id] = acc[j.menu_item_id] || []).push(
            mapModifierGroup(group, optionsByGroup[group.id] || []),
          );
          return acc;
        }, {});
        const settingsByItem = (locationSettingsRows || []).reduce((acc: any, row: any) => {
          acc[row.menu_item_id] = row;
          return acc;
        }, {});
        const mappedItems = (itemRows || [])
          .filter((row: any) => staffOrgId || row.active)
          .map((it: any) => mapMenuItem(it, groupsByItem[it.id] || [], settingsByItem[it.id]));
        setMenuItems(mappedItems);
        // Reconcile display prices after a catalog refresh; the server still validates every order.
        setCart((prev) =>
          prev.map((ci) => {
            const item = mappedItems.find((m) => m.id === ci.menuItem.id);
            if (!item) return ci;
            const modifiers = ci.selectedModifiers.map((m) => {
              const option = item.modifierGroups
                ?.flatMap((g) => g.options)
                .find((o) => o.id === m.optionId);
              return option ? { ...m, optionName: option.name, priceDelta: option.priceDelta } : m;
            });
            const unitPrice = item.price + modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
            return {
              ...ci,
              menuItem: item,
              selectedModifiers: modifiers,
              unitPrice,
              totalPrice: unitPrice * ci.quantity,
            };
          }),
        );

        const { data: reviewRows, error: reviewError } = await supabase
          .from('reviews')
          .select('*, customers(name)')
          .eq('restaurant_id', rest.id)
          .order('created_at', { ascending: false });
        if (reviewError) throw new Error(reviewError.message);
        if (cancelled) return;
        setReviews((reviewRows || []).map(mapReview));
        loadedCatalog.current = true;
        setDataRefreshing(false);

        setDataLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setDataRefreshing(false);
          setDataError(err?.message || 'Failed to load restaurant data');
          setDataLoading(false);
        }
      } finally {
        if (!cancelled) {
          catalogInFlight.current = false;
          if (catalogRefreshQueued.current) {
            catalogRefreshQueued.current = false;
            setReloadTick((t) => t + 1);
          }
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      catalogInFlight.current = false;
      catalogRefreshQueued.current = false;
    };
  }, [
    activeRestaurantId,
    tenantLocationId,
    tenantLoading,
    tenantError,
    reloadTick,
    setTenantLocationId,
    staffOrgId,
    resolvedTableId,
    publicTableToken,
  ]);

  // Resolve active table strictly from the QR-resolved table (never guessed).
  useEffect(() => {
    if (resolvedTableId && tables.length > 0) {
      const match = tables.find((t) => t.id === resolvedTableId);
      if (match) setActiveTable(match);
    }
    setOrders((prev) =>
      prev.map((order) => {
        const info = lookupTableInfo(order.tableId);
        return { ...order, ...info };
      }),
    );
    setActiveOrder((prev) => {
      if (!prev) return prev;
      const info = lookupTableInfo(prev.tableId);
      return { ...prev, ...info };
    });
  }, [resolvedTableId, tables, areas, lookupTableInfo]);

  // Stable IDs own subscriptions; late requests cannot overwrite a different location.
  const orderRequest = useRef(0);
  const serviceRequest = useRef(0);
  const fetchOrders = useCallback(async () => {
    if (!staffOrgId || !activeRestaurantId || !tenantLocationId) {
      setOrders([]);
      return;
    }
    const request = ++orderRequest.current;
    const { data, error } = await supabase
      .from('orders')
      .select(
        '*, customers(name, phone), order_items(*, order_item_modifiers(*)), order_status_events(*)',
      )
      .eq('organization_id', staffOrgId)
      .eq('restaurant_id', activeRestaurantId)
      .eq('location_id', tenantLocationId)
      .order('created_at', { ascending: false });
    if (!aliveRef.current || request !== orderRequest.current) return;
    if (error) {
      setMutationError(`Orders could not refresh: ${error.message}`);
      return;
    }
    setOrders(
      (data ?? []).map((o: any) => {
        const info = lookupTableInfo(o.table_id);
        return mapOrder(o, info.tableNumber, info.areaName);
      }),
    );
  }, [staffOrgId, activeRestaurantId, tenantLocationId, lookupTableInfo]);
  const fetchServiceRequests = useCallback(async () => {
    if (!staffOrgId || !tenantLocationId) {
      setServiceRequests([]);
      return;
    }
    const request = ++serviceRequest.current;
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('location_id', tenantLocationId)
      .order('created_at', { ascending: false });
    if (!aliveRef.current || request !== serviceRequest.current) return;
    if (error) {
      setMutationError(
        /permission denied for function current_customer_id/i.test(error.message)
          ? 'Service requests need a database permissions update. Ask your administrator to apply the reviewed V3 migrations.'
          : `Service requests could not refresh: ${error.message}`,
      );
      return;
    }
    setServiceRequests(
      (data ?? []).map((r: any) => {
        const info = lookupTableInfo(r.table_id);
        return mapServiceRequest(r, info.tableNumber ?? '', info.areaName ?? '');
      }),
    );
  }, [staffOrgId, tenantLocationId, lookupTableInfo]);
  useEffect(() => {
    setOrders([]);
    setServiceRequests([]);
    void fetchOrders();
    void fetchServiceRequests();
    if (!staffOrgId || !tenantLocationId) return;
    let disposed = false;
    let subscribedOnce = false;
    const invalidate = () => {
      orderRequest.current++;
      serviceRequest.current++;
    };
    const channel = supabase
      .channel(`staff-${staffOrgId}-${tenantLocationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `location_id=eq.${tenantLocationId}`,
        },
        (payload) => {
          if (disposed) return;
          void fetchOrders();
          if (payload.eventType === 'INSERT') playOrderChimeRef.current();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `location_id=eq.${tenantLocationId}`,
        },
        () => {
          if (!disposed) void fetchServiceRequests();
        },
      )
      .subscribe((status) => {
        diagnostic('realtime-status', { status });
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) {
            void fetchOrders();
            void fetchServiceRequests();
          }
          subscribedOnce = true;
        }
      });
    // A quiet publication or temporary websocket outage must not leave POS/KDS stale.
    const interval = window.setInterval(() => {
      if (!document.hidden && !disposed) {
        void fetchOrders();
        void fetchServiceRequests();
      }
    }, 15000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      invalidate();
      void supabase.removeChannel(channel);
    };
  }, [staffOrgId, tenantLocationId, fetchOrders, fetchServiceRequests]);

  useEffect(() => {
    if (!tracking || source === 'staff-org') return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      if (tracking.expiresAt <= Date.now()) {
        setTrackingError('Order tracking has expired. Please ask the restaurant for assistance.');
        setTracking(null);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_public_order_snapshot', {
          p_order_id: tracking.id,
          p_tracking_token: tracking.token,
        });
        if (cancelled) return;
        if (error) {
          if (/not found|expired|invalid/i.test(error.message)) {
            setTrackingError('This tracking link is invalid or expired.');
            writeStorage(`dinesaurus:tracking:${activeRestaurantId}`, null, 'session');
            setTracking(null);
            setActiveOrder(null);
            return;
          }
          throw new Error(error.message);
        }
        if (!data || data.restaurant_id !== activeRestaurantId)
          throw new Error('This order does not belong to the current restaurant.');
        const info = lookupTableInfo(data.table_id);
        setActiveOrder(mapOrder(data, info.tableNumber, info.areaName));
        setTrackingError(null);
        if (['completed', 'cancelled', 'rejected'].includes(data.status)) return;
      } catch (error) {
        if (!cancelled)
          setTrackingError(
            error instanceof Error
              ? error.message
              : 'Tracking is temporarily unavailable. Retrying?',
          );
      }
      if (!cancelled) timer = window.setTimeout(poll, document.hidden ? 15000 : 5000);
    };
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tracking, source, activeRestaurantId, lookupTableInfo]);

  // ============ LOYALTY REWARDS (customer) ============
  useEffect(() => {
    let cancelled = false;
    if (!scopedCustomerId) {
      setRewardRows([]);
      return;
    }
    void supabase
      .from('customer_rewards')
      .select('*')
      .eq('customer_id', scopedCustomerId)
      .then(({ data, error }) => {
        if (!cancelled) {
          if (error) setMutationError(error.message);
          else setRewardRows(data || []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scopedCustomerId]);

  // ============ PLAN / FEATURES (staff) ============
  useEffect(() => {
    if (!staffOrgId) return;
    (async () => {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('organization_id', staffOrgId)
        .maybeSingle();
      if (sub?.plans) {
        setCurrentPlan({
          id: sub.plans.code,
          name: sub.plans.name,
          priceMonthly: Number(sub.plans.monthly_price),
          currency: sub.plans.currency,
          features: [],
          maxLocations: 99,
          maxTables: 999,
          orderLimitMonthly: 99999,
        });
      }
      const { data: overrides } = await supabase
        .from('organization_feature_overrides')
        .select('*, features(code)')
        .eq('organization_id', staffOrgId);
      if (overrides && overrides.length > 0) {
        setFeatureFlags((prev) => {
          const next = { ...prev };
          overrides.forEach((o: any) => {
            const code = o.features?.code as keyof FeatureFlags;
            if (code && code in next) next[code] = o.enabled;
          });
          return next;
        });
      }
    })();
  }, [staffOrgId]);

  // Audio Chime synthesizer
  const playOrderChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now + 0.15);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.5);
      osc2.onended = () => {
        void ctx.close();
      };
    } catch (err) {
      /* needs user gesture first */
    }
  }, [soundEnabled]);
  const playOrderChimeRef = useRef(playOrderChime);
  useEffect(() => {
    playOrderChimeRef.current = playOrderChime;
  }, [playOrderChime]);

  // ============ CART (ephemeral UI state — fine to keep client-only) ============
  const addToCart = (
    item: MenuItem,
    quantity: number,
    selectedModifiers: SelectedModifier[],
    specialInstructions?: string,
  ) => {
    const modifierTotal = selectedModifiers.reduce((s, m) => s + m.priceDelta, 0);
    const unitPrice = item.price + modifierTotal;
    const cartItem: CartItem = {
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      menuItem: item,
      quantity,
      selectedModifiers,
      specialInstructions,
      unitPrice,
      totalPrice: unitPrice * quantity,
    };
    setCart((prev) => [...prev, cartItem]);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) =>
          ci.id === cartItemId
            ? {
                ...ci,
                quantity: Math.max(0, ci.quantity + delta),
                totalPrice: ci.unitPrice * Math.max(0, ci.quantity + delta),
              }
            : ci,
        )
        .filter((ci) => ci.quantity > 0),
    );
  };

  const removeFromCart = (cartItemId: string) =>
    setCart((prev) => prev.filter((ci) => ci.id !== cartItemId));
  const clearCart = () => setCart([]);

  const cartTotalAmount = useMemo(() => cart.reduce((s, ci) => s + ci.totalPrice, 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((s, ci) => s + ci.quantity, 0), [cart]);

  const submitOrder = useMemo(
    () => createOrderSubmitter(supabase, `${activeRestaurantId}:${tenantLocationId}`),
    [activeRestaurantId, tenantLocationId],
  );
  // ============ ORDERS: CREATE / UPDATE ============
  const createOrder = async (orderData: {
    orderMode: OrderMode;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: Order['paymentMethod'];
    tipAmount?: number;
    carDeliveryDetails?: Order['carDeliveryDetails'];
    specialNotes?: string;
    items?: CartItem[];
    tableId?: string;
  }): Promise<Order> => {
    if (!restaurant) throw new Error('No restaurant is loaded.');
    const orderCart = orderData.items ?? cart;
    if (!orderCart.length) throw new Error('Your cart is empty.');
    const name = (orderData.customerName || '').trim();
    const phone = (orderData.customerPhone || '').trim();
    const validation = validateGuest(name, phone);
    if (validation) throw new Error(validation);
    const token =
      source === 'staff-org'
        ? tables.find((t) => t.id === (orderData.tableId ?? activeTable?.id))?.publicToken
        : publicTableToken;
    if (!token) throw new Error('Scan a valid table QR before placing this order.');
    if (orderCart.some((ci) => !menuItems.some((m) => m.id === ci.menuItem.id && !m.isSoldOut)))
      throw new Error('An item is unavailable. Please update your cart.');
    const rawOrder = await submitOrder(
      {
        p_public_token: token,
        p_items: orderCart.map((ci) => ({
          menu_item_id: ci.menuItem.id,
          quantity: ci.quantity,
          special_instructions: ci.specialInstructions || null,
          modifiers: ci.selectedModifiers.map((m) => ({ modifier_option_id: m.optionId })),
        })),
        p_expected_total: orderTotals(
          orderCart.reduce((sum, ci) => sum + ci.totalPrice, 0),
          restaurant.taxRatePercent,
          restaurant.serviceChargePercent,
          orderData.tipAmount || 0,
        ).grandTotal,
        p_customer_name: name,
        p_customer_phone: phone,
        p_payment_method: orderData.paymentMethod || 'cash',
        p_tip: orderData.tipAmount || 0,
        p_special_notes: orderData.specialNotes || null,
        p_order_mode: orderData.orderMode,
        p_customer_id: null,
        p_car_delivery: null,
      },
      orderCart.map((ci) => ci.id).join(','),
    );
    const info = lookupTableInfo(rawOrder.table_id);
    const finalOrder = mapOrder(rawOrder, info.tableNumber, info.areaName);
    if (finalOrder.publicTrackingToken) {
      const record = {
        id: finalOrder.id,
        token: finalOrder.publicTrackingToken,
        restaurantId: restaurant.id,
        expiresAt: Date.now() + TRACKING_TTL,
      };
      saveTracking(record);
      if (aliveRef.current) setTracking(record);
    }
    if (aliveRef.current) {
      if (!orderData.items) clearCart();
      setActiveOrder(finalOrder);
      void fetchOrders();
      playOrderChime();
    }
    return finalOrder;
  };

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus, note?: string) =>
    performWrite(async () => {
      const { error } = await supabase.rpc('update_order_status_secure', {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_note: note ?? null,
      });
      if (error) throw new Error(error.message);
      await fetchOrders();
    });

  const assertStaff = () => {
    if (!staffOrgId || !staff?.isActive) throw new Error('Active staff authorization is required.');
  };
  const updateTableStatus = (tableId: string, status: RestaurantTable['status']) =>
    performWrite(async () => {
      assertStaff();
      if (status === 'billed')
        throw new Error(
          'Billing is recorded on the order. Use occupied until the table is ready to clear.',
        );
      const row = requireRow(
        await supabase
          .from('restaurant_tables')
          .update({ status })
          .eq('id', tableId)
          .eq('location_id', tenantLocationId)
          .select()
          .single(),
      );
      if (!aliveRef.current) return;
      setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: row.status } : t)));
      if (activeTable?.id === tableId)
        setActiveTable((prev) => (prev ? { ...prev, status: row.status } : null));
    });
  const saveTable = (table: RestaurantTable) =>
    performWrite(async () => {
      assertStaff();
      if (
        !tenantLocationId ||
        !areas.some((a) => a.id === table.areaId && a.locationId === tenantLocationId)
      )
        throw new Error('Select an area in this location.');
      if (!table.name.trim() || !Number.isInteger(table.capacity) || table.capacity < 1)
        throw new Error('Enter a table name and a positive capacity.');
      const existing = tables.find((t) => t.id === table.id);
      let saved;
      if (existing) {
        const row = requireRow(
          await supabase
            .from('restaurant_tables')
            .update({
              display_name: table.name,
              capacity: table.capacity,
              area_id: table.areaId,
              status: table.status,
            })
            .eq('id', table.id)
            .eq('location_id', tenantLocationId)
            .select()
            .single(),
        );
        let qr = { public_token: existing.publicToken };
        if (!qr.public_token) {
          qr = requireRow(
            await supabase
              .from('table_qr_codes')
              .insert([
                { table_id: row.id, public_token: `qr_${crypto.randomUUID()}`, status: 'active' },
              ])
              .select()
              .single(),
          );
        }
        saved = mapTable(row, qr);
      } else {
        const { table: row, qr } = await createTableWithQr(supabase, {
          location_id: tenantLocationId,
          area_id: table.areaId,
          display_name: table.name,
          capacity: table.capacity,
          status: table.status,
        });
        saved = mapTable(row, qr);
      }
      if (aliveRef.current)
        setTables((prev) =>
          existing ? prev.map((t) => (t.id === existing.id ? saved : t)) : [...prev, saved],
        );
    });
  const deleteTable = (tableId: string) =>
    performWrite(async () => {
      assertStaff();
      requireRow(
        await supabase
          .from('restaurant_tables')
          .delete()
          .eq('id', tableId)
          .eq('location_id', tenantLocationId)
          .select('id'),
      );
      if (aliveRef.current) {
        setTables((prev) => prev.filter((t) => t.id !== tableId));
        if (activeTable?.id === tableId) setActiveTable(null);
      }
    });
  const toggleItemSoldOut = (itemId: string) =>
    performWrite(async () => {
      assertStaff();
      const item = menuItems.find((i) => i.id === itemId);
      if (!item) throw new Error('Menu item not found.');
      const row = await saveMenuStock(supabase, itemId, tenantLocationId || '', !item.isSoldOut);
      if (aliveRef.current)
        setMenuItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  isSoldOut: i.isActive === false || row.available === false || !!row.sold_out,
                }
              : i,
          ),
        );
    });
  const saveMenuItem = (item: MenuItem) =>
    performWrite(async () => {
      assertStaff();
      if (!restaurant || !categories.some((c) => c.id === item.categoryId))
        throw new Error('Select a category from this restaurant.');
      if (!item.name.trim() || !Number.isFinite(item.price) || item.price < 0)
        throw new Error('Enter an item name and a valid price.');
      const existing = menuItems.find((i) => i.id === item.id);
      const payload = {
        category_id: item.categoryId,
        name: item.name.trim(),
        short_description: item.description,
        image_path: item.imageUrl,
        base_price:
          existing && item.price === existing.price
            ? (existing.basePrice ?? item.price)
            : item.price,
        vegetarian: !!item.isVegetarian,
        vegan: !!item.isVegan,
        gluten_free: !!item.isGlutenFree,
        featured: !!item.isFeatured,
        active: existing ? existing.isActive : true,
      };
      let row = requireRow(
        existing
          ? await supabase
              .from('menu_items')
              .update(payload)
              .eq('id', item.id)
              .eq('restaurant_id', restaurant.id)
              .select()
              .single()
          : await supabase
              .from('menu_items')
              .insert([
                {
                  ...payload,
                  active: false,
                  restaurant_id: restaurant.id,
                  currency:
                    restaurant.locations.find((l) => l.id === tenantLocationId)?.currency ??
                    restaurant.currencyCode,
                },
              ])
              .select()
              .single(),
      );
      let stockRow;
      try {
        stockRow = await saveMenuStock(supabase, row.id, tenantLocationId || '', !!item.isSoldOut);
        if (!existing) {
          row = requireRow(
            await supabase
              .from('menu_items')
              .update({ active: true })
              .eq('id', row.id)
              .eq('restaurant_id', restaurant.id)
              .select()
              .single(),
          );
        }
      } catch (error) {
        // Existing details may have saved; reconcile them and keep the editor open.
        // A new item must not be left falsely advertised in stock after its stock write fails.
        if (!existing) {
          const cleanup = await supabase.from('menu_items').delete().eq('id', row.id).select('id');
          if (cleanup.error || !cleanup.data?.length) {
            retryLoad();
            throw new Error(
              'Stock could not be confirmed and the item may exist. Reload the menu before creating it again.',
            );
          }
        }
        retryLoad();
        throw new Error(
          `Item availability was not saved: ${error instanceof Error ? error.message : 'Please retry.'}`,
        );
      }
      if (aliveRef.current) {
        const mapped = mapMenuItem(row, existing?.modifierGroups ?? [], stockRow);
        setMenuItems((prev) =>
          existing ? prev.map((i) => (i.id === existing.id ? mapped : i)) : [...prev, mapped],
        );
        retryLoad();
      }
    });
  const deleteMenuItem = (itemId: string) =>
    performWrite(async () => {
      assertStaff();
      requireRow(
        await supabase
          .from('menu_items')
          .delete()
          .eq('id', itemId)
          .eq('restaurant_id', activeRestaurantId)
          .select('id'),
      );
      if (aliveRef.current) setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
    });
  const saveCategory = (category: MenuCategory) =>
    performWrite(async () => {
      assertStaff();
      if (!restaurant || !category.name.trim()) throw new Error('A category name is required.');
      const existing = categories.some((c) => c.id === category.id);
      const payload = {
        name: category.name.trim(),
        description: category.description,
        sort_order: category.sortOrder,
        active: category.isActive,
      };
      const row = requireRow(
        existing
          ? await supabase
              .from('menu_categories')
              .update(payload)
              .eq('id', category.id)
              .eq('restaurant_id', restaurant.id)
              .select()
              .single()
          : await supabase
              .from('menu_categories')
              .insert([{ ...payload, restaurant_id: restaurant.id }])
              .select()
              .single(),
      );
      if (aliveRef.current)
        setCategories((prev) =>
          existing
            ? prev.map((c) => (c.id === category.id ? mapCategory(row) : c))
            : [...prev, mapCategory(row)],
        );
    });
  const createServiceRequest = (type: ServiceRequest['type'], customMessage?: string) =>
    performWrite(async () => {
      if (!activeTable || !publicTableToken)
        throw new Error('Scan your table QR before requesting service.');
      const { data, error } = await supabase.rpc('create_guest_service_request', {
        p_public_token: publicTableToken,
        p_request_type: type,
        p_message: customMessage || null,
      });
      if (error || !data)
        throw new Error(error?.message || 'The service request was not confirmed.');
      await fetchServiceRequests();
    });
  const updateServiceRequestStatus = (requestId: string, status: ServiceRequest['status']) =>
    performWrite(async () => {
      assertStaff();
      requireRow(
        await supabase
          .from('service_requests')
          .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
          .eq('id', requestId)
          .eq('location_id', tenantLocationId)
          .select('id'),
      );
      await fetchServiceRequests();
    });

  // ============ LOYALTY ============
  const customerProfile: CustomerProfile = scopedCustomer
    ? {
        id: scopedCustomer.id,
        name: scopedCustomer.name,
        phone: scopedCustomer.phone || '',
        email: user?.email || '',
        pointsBalance: scopedCustomer.pointsBalance,
        stampsCount: scopedCustomer.stampsCount,
        stampsRequired: scopedCustomer.stampsRequired,
        tier: (scopedCustomer.tier as any) || 'Silver',
        joinedAt: new Date().toISOString(),
        totalOrdersCount: orders.length,
        savedRewards: rewardRows.map((r) => ({
          id: r.id,
          title: r.title,
          pointsCost: 0,
          description: r.description || '',
          code: r.reward_type,
          isUnlocked: !!r.redeemed_at,
        })),
      }
    : EMPTY_PROFILE;

  const redeemReward = (_rewardId: string) =>
    performWrite(async () => {
      throw new Error(
        'Ask restaurant staff to redeem rewards. Guest phone entry does not verify loyalty ownership.',
      );
    });
  const addCustomerStamps = (_stamps: number) =>
    performWrite(async () => {
      throw new Error('Loyalty credits must be awarded by a verified server operation.');
    });
  const submitReview = (rating: number, comment: string, _tags?: string[]) =>
    performWrite(async () => {
      if (!scopedCustomer || !activeOrder || !restaurant || !tenantLocationId)
        throw new Error(
          'Verified order ownership is required for reviews. Please share your feedback with restaurant staff.',
        );
      requireRow(
        await supabase
          .from('reviews')
          .insert([
            {
              order_id: activeOrder.id,
              restaurant_id: restaurant.id,
              location_id: tenantLocationId,
              overall_rating: rating,
              comment,
              customer_id: scopedCustomer.id,
            },
          ])
          .select('id'),
      );
      retryLoad();
    });
  const replyToReview = (reviewId: string, replyText: string) =>
    performWrite(async () => {
      assertStaff();
      const row = requireRow(
        await supabase
          .from('reviews')
          .update({ staff_reply: replyText })
          .eq('id', reviewId)
          .eq('restaurant_id', activeRestaurantId)
          .select()
          .single(),
      );
      if (aliveRef.current)
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, reply: row.staff_reply } : r)),
        );
    });
  const toggleFeatureFlag = (flag: keyof FeatureFlags) =>
    performWrite(async () => {
      assertStaff();
      const newVal = !featureFlags[flag];
      const feature = requireRow(
        await supabase.from('features').select('id').eq('code', flag).single(),
      );
      const row = requireRow(
        await supabase
          .from('organization_feature_overrides')
          .upsert([{ organization_id: staffOrgId, feature_id: feature.id, enabled: newVal }], {
            onConflict: 'organization_id,feature_id',
          })
          .select()
          .single(),
      );
      if (aliveRef.current) setFeatureFlags((prev) => ({ ...prev, [flag]: row.enabled }));
    });
  const updateRestaurantSettings = (updated: Partial<Restaurant>) =>
    performWrite(async () => {
      assertStaff();
      if (!restaurant) throw new Error('No restaurant is loaded.');
      const payload: Record<string, unknown> = {};
      for (const [key, column] of Object.entries({
        name: 'name',
        description: 'description',
        logoUrl: 'logo_path',
        coverImageUrl: 'cover_image_path',
        cuisineType: 'restaurant_type',
        taxRatePercent: 'tax_rate_percent',
        serviceChargePercent: 'service_charge_percent',
      })) {
        const value = updated[key as keyof Restaurant];
        if (value !== undefined) payload[column] = value;
      }
      if (!Object.keys(payload).length) throw new Error('No supported settings were changed.');
      const row = requireRow(
        await supabase
          .from('restaurants')
          .update(payload)
          .eq('id', restaurant.id)
          .select()
          .single(),
      );
      if (aliveRef.current)
        setRestaurant(
          mapRestaurant(
            row,
            restaurant.locations.map((l) => ({
              id: l.id,
              restaurant_id: l.restaurantId,
              name: l.name,
              city: l.city,
              address_line_1: l.address,
              phone: l.phone,
              currency: l.currency,
              timezone: l.timezone,
            })),
          ),
        );
    });

  return (
    <RestaurantContext.Provider
      value={{
        viewMode,
        setViewMode,
        restaurant,
        activeLocationId: tenantLocationId || '',
        setActiveLocationId: setTenantLocationId,
        activeTable,
        setActiveTable,
        dataLoading,
        dataError,
        dataRefreshing,
        mutationError,
        dismissMutationError,
        trackingError,
        retryLoad,

        categories,
        menuItems,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        dietaryFilters,
        setDietaryFilters,
        toggleItemSoldOut,
        saveMenuItem,
        deleteMenuItem,
        saveCategory,

        areas,
        tables,
        updateTableStatus,
        saveTable,
        deleteTable,

        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartTotalAmount,
        cartItemCount,

        orders,
        activeOrder,
        setActiveOrder,
        createOrder,
        updateOrderStatus,

        serviceRequests,
        createServiceRequest,
        updateServiceRequestStatus,

        customerProfile,
        redeemReward,
        addCustomerStamps,

        reviews,
        submitReview,
        replyToReview,

        currentPlan,
        setCurrentPlan,
        featureFlags,
        toggleFeatureFlag,
        updateRestaurantSettings,

        soundEnabled,
        setSoundEnabled,
        playOrderChime,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  return context;
};
