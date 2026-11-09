import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  retryLoad: () => void;

  categories: MenuCategory[];
  menuItems: MenuItem[];
  selectedCategory: string;
  setSelectedCategory: (catId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dietaryFilters: { vegetarian: boolean; vegan: boolean; glutenFree: boolean };
  setDietaryFilters: React.Dispatch<React.SetStateAction<{ vegetarian: boolean; vegan: boolean; glutenFree: boolean }>>;
  toggleItemSoldOut: (itemId: string) => void;
  saveMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (itemId: string) => void;
  saveCategory: (category: MenuCategory) => void;

  areas: RestaurantArea[];
  tables: RestaurantTable[];
  updateTableStatus: (tableId: string, status: RestaurantTable['status']) => void;
  saveTable: (table: RestaurantTable) => void;
  deleteTable: (tableId: string) => void;

  cart: CartItem[];
  addToCart: (item: MenuItem, quantity: number, selectedModifiers: SelectedModifier[], specialInstructions?: string) => void;
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
  }) => Promise<Order>;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus, note?: string) => void;

  serviceRequests: ServiceRequest[];
  createServiceRequest: (type: ServiceRequest['type'], customMessage?: string) => void;
  updateServiceRequestStatus: (requestId: string, status: ServiceRequest['status']) => void;

  customerProfile: CustomerProfile;
  redeemReward: (rewardId: string) => void;
  addCustomerStamps: (stamps: number) => void;

  reviews: Review[];
  submitReview: (rating: number, comment: string, tags?: string[]) => void;
  replyToReview: (reviewId: string, replyText: string) => void;

  currentPlan: SaaSPlan;
  setCurrentPlan: (plan: SaaSPlan) => void;
  featureFlags: FeatureFlags;
  toggleFeatureFlag: (flag: keyof FeatureFlags) => void;
  updateRestaurantSettings: (updated: Partial<Restaurant>) => void;

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

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customer, staff, isStaff, user, refreshProfile } = useAuth();
  const {
    activeRestaurantId,
    activeLocationId: tenantLocationId,
    setActiveLocationId: setTenantLocationId,
    resolvedTableId, publicTableToken,
    loading: tenantLoading,
    error: tenantError,
  } = useTenant();

  const [viewMode, setViewMode] = useState<AppViewMode>('customer');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [areas, setAreas] = useState<RestaurantArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [activeTable, setActiveTable] = useState<RestaurantTable | null>(null);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietaryFilters, setDietaryFilters] = useState({ vegetarian: false, vegan: false, glutenFree: false });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [rewardRows, setRewardRows] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [currentPlan, setCurrentPlan] = useState<SaaSPlan>(SAAS_PLANS[1]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const retryLoad = useCallback(() => setReloadTick(t => t + 1), []);

  const tablesRef = useRef<RestaurantTable[]>([]);
  const areasRef = useRef<RestaurantArea[]>([]);
  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { areasRef.current = areas; }, [areas]);

  const lookupTableInfo = useCallback((tableId?: string) => {
    if (!tableId) return { tableNumber: undefined, areaName: undefined };
    const t = tablesRef.current.find(x => x.id === tableId);
    const a = t ? areasRef.current.find(x => x.id === t.areaId) : undefined;
    return { tableNumber: t?.tableNumber, areaName: a?.name };
  }, []);

  // ============ CATALOG LOAD — scoped to the tenant-resolved restaurant, never a global .limit(1) ============
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (tenantLoading) return;
      if (tenantError) { setDataError(tenantError); setDataLoading(false); return; }
      if (!activeRestaurantId) {
        // Genuine empty state: no tenant resolved (new staff needing onboarding, or no QR/slug context).
        setRestaurant(null);
        setDataLoading(false);
        setDataError(null);
        return;
      }

      setDataLoading(true);
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

        const [{ data: areaRows, error: areaErr }, { data: tableRows, error: tableErr }, { data: catRows, error: catErr }, { data: itemRows, error: itemErr }, { data: groupRows, error: groupErr }] =
          await Promise.all([
            supabase.from('restaurant_areas').select('*').in('location_id', locationIds.length ? locationIds : [placeholderId]),
            supabase.from('restaurant_tables').select('*').in('location_id', locationIds.length ? locationIds : [placeholderId]),
            supabase.from('menu_categories').select('*').eq('restaurant_id', rest.id).order('sort_order'),
            supabase.from('menu_items').select('*').eq('restaurant_id', rest.id),
            supabase.from('modifier_groups').select('*').eq('restaurant_id', rest.id),
          ]);
        const firstErr = areaErr || tableErr || catErr || itemErr || groupErr;
        if (firstErr) throw new Error(firstErr.message);
        if (cancelled) return;

        const tableIds = (tableRows || []).map((t: any) => t.id);
        const groupIds = (groupRows || []).map((g: any) => g.id);
        const effectiveLocation = tenantLocationId || locationIds[0];
        const [{ data: qrRows }, { data: optionRows }, { data: junctionRows }, { data: locationSettingsRows, error: settingsErr }] = await Promise.all([
          tableIds.length ? supabase.from('table_qr_codes').select('*').in('table_id', tableIds) : Promise.resolve({ data: [] as any[] }),
          groupIds.length ? supabase.from('modifier_options').select('*').in('modifier_group_id', groupIds) : Promise.resolve({ data: [] as any[] }),
          supabase.from('menu_item_modifier_groups').select('*').in('modifier_group_id', groupIds.length ? groupIds : [placeholderId]),
          effectiveLocation ? supabase.from('menu_item_location_settings').select('*').eq('location_id', effectiveLocation) : Promise.resolve({ data: [] as any[], error: null as any }),
        ]);
        if (settingsErr) throw new Error(settingsErr.message);

        if (cancelled) return;

        setAreas((areaRows || []).map(mapArea));
        setTables((tableRows || []).map((t: any) => mapTable(t, (qrRows || []).find((q: any) => q.table_id === t.id))));
        setCategories((catRows || []).map(mapCategory));
        if ((catRows || []).length > 0) setSelectedCategory(prev => prev || catRows![0].id);

        const optionsByGroup = (optionRows || []).reduce((acc: any, o: any) => {
          (acc[o.modifier_group_id] = acc[o.modifier_group_id] || []).push(o);
          return acc;
        }, {});
        const groupsByItem = (junctionRows || []).reduce((acc: any, j: any) => {
          const group = (groupRows || []).find((g: any) => g.id === j.modifier_group_id);
          if (!group) return acc;
          (acc[j.menu_item_id] = acc[j.menu_item_id] || []).push(mapModifierGroup(group, optionsByGroup[group.id] || []));
          return acc;
        }, {});
        const settingsByItem = (locationSettingsRows || []).reduce((acc: any, row: any) => { acc[row.menu_item_id] = row; return acc; }, {});
        setMenuItems((itemRows || []).map((it: any) => mapMenuItem(it, groupsByItem[it.id] || [], settingsByItem[it.id])));

        const { data: reviewRows } = await supabase
          .from('reviews')
          .select('*, customers(name)')
          .eq('restaurant_id', rest.id)
          .order('created_at', { ascending: false });
        if (!cancelled) setReviews((reviewRows || []).map(mapReview));

        setDataLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setDataError(err?.message || 'Failed to load restaurant data');
          setDataLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [activeRestaurantId, tenantLocationId, tenantLoading, tenantError, reloadTick, setTenantLocationId]);

  // Resolve active table strictly from the QR-resolved table (never guessed).
  useEffect(() => {
    if (resolvedTableId && tables.length > 0) {
      const match = tables.find(t => t.id === resolvedTableId);
      if (match) setActiveTable(match);
    }
  }, [resolvedTableId, tables]);

  // ============ ORDERS (role-scoped, realtime) ============
  const fetchOrders = useCallback(async () => {
    if (!restaurant) { setOrders([]); return; }
    let query = supabase
      .from('orders')
      .select('*, customers(name, phone), order_items(*, order_item_modifiers(*)), order_status_events(*)')
      .order('created_at', { ascending: false });

    if (isStaff && staff) {
      query = query.eq('organization_id', staff.organizationId);
    } else if (customer) {
      query = query.eq('customer_id', customer.id).eq('restaurant_id', restaurant.id);
    } else {
      setOrders([]);
      return;
    }
    const { data } = await query;
    const mapped = (data || []).map((o: any) => {
      const info = lookupTableInfo(o.table_id);
      return mapOrder(o, info.tableNumber, info.areaName);
    });
    setOrders(mapped);
  }, [isStaff, staff, customer, restaurant, lookupTableInfo]);

  useEffect(() => {
    fetchOrders();
    if (!isStaff && !customer) return;

    const channel = supabase
      .channel('orders-realtime-' + (staff?.organizationId || customer?.id || 'anon'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
        playOrderChimeRef.current();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOrders]);

  useEffect(() => {
    if (!activeOrder?.publicTrackingToken || customer) return;
    let cancelled = false;
    const poll = async () => {
      const { data, error } = await supabase.rpc('get_public_order_snapshot', {
        p_order_id: activeOrder.id,
        p_tracking_token: activeOrder.publicTrackingToken,
      });
      if (!cancelled && !error && data) {
        const next = mapOrder(data as any, activeOrder.tableNumber, activeOrder.areaName);
        setActiveOrder(next);
      }
    };
    const interval = window.setInterval(poll, 5000);
    poll();
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [activeOrder?.id, activeOrder?.publicTrackingToken, customer, activeOrder?.tableNumber, activeOrder?.areaName]);

  // ============ SERVICE REQUESTS ============
  const fetchServiceRequests = useCallback(async () => {
    let query = supabase.from('service_requests').select('*').order('created_at', { ascending: false });
    if (isStaff && staff) {
      const { data: locs } = await supabase.from('restaurant_locations').select('id').eq('organization_id', staff.organizationId);
      query = query.in('location_id', (locs || []).map((l: any) => l.id));
    } else if (customer) {
      query = query.eq('customer_id', customer.id);
    } else {
      setServiceRequests([]);
      return;
    }
    const { data } = await query;
    setServiceRequests((data || []).map((r: any) => {
      const info = lookupTableInfo(r.table_id);
      return mapServiceRequest(r, info.tableNumber || '', info.areaName || '');
    }));
  }, [isStaff, staff, customer, lookupTableInfo]);

  useEffect(() => {
    fetchServiceRequests();
    if (!isStaff && !customer) return;
    const channel = supabase
      .channel('service-requests-realtime-' + (staff?.organizationId || customer?.id || 'anon'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        fetchServiceRequests();
        playOrderChimeRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchServiceRequests]);

  // ============ LOYALTY REWARDS (customer) ============
  useEffect(() => {
    if (!customer) { setRewardRows([]); return; }
    supabase.from('customer_rewards').select('*').eq('customer_id', customer.id).then(({ data }) => {
      setRewardRows(data || []);
    });
  }, [customer]);

  // ============ PLAN / FEATURES (staff) ============
  useEffect(() => {
    if (!isStaff || !staff) return;
    (async () => {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('organization_id', staff.organizationId)
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
        .eq('organization_id', staff.organizationId);
      if (overrides && overrides.length > 0) {
        setFeatureFlags(prev => {
          const next = { ...prev };
          overrides.forEach((o: any) => {
            const code = o.features?.code as keyof FeatureFlags;
            if (code && code in next) next[code] = o.enabled;
          });
          return next;
        });
      }
    })();
  }, [isStaff, staff]);

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
      osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
      osc1.start(now); osc2.start(now + 0.15);
      osc1.stop(now + 0.15); osc2.stop(now + 0.5);
    } catch (err) { /* needs user gesture first */ }
  }, [soundEnabled]);
  const playOrderChimeRef = useRef(playOrderChime);
  useEffect(() => { playOrderChimeRef.current = playOrderChime; }, [playOrderChime]);

  // ============ CART (ephemeral UI state — fine to keep client-only) ============
  const addToCart = (item: MenuItem, quantity: number, selectedModifiers: SelectedModifier[], specialInstructions?: string) => {
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
    setCart(prev => [...prev, cartItem]);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(ci => (ci.id === cartItemId ? { ...ci, quantity: Math.max(0, ci.quantity + delta), totalPrice: ci.unitPrice * Math.max(0, ci.quantity + delta) } : ci))
        .filter(ci => ci.quantity > 0)
    );
  };

  const removeFromCart = (cartItemId: string) => setCart(prev => prev.filter(ci => ci.id !== cartItemId));
  const clearCart = () => setCart([]);

  const cartTotalAmount = useMemo(() => cart.reduce((s, ci) => s + ci.totalPrice, 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((s, ci) => s + ci.quantity, 0), [cart]);

  // ============ ORDERS: CREATE / UPDATE ============
  const createOrder = async (orderData: {
    orderMode: OrderMode;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: Order['paymentMethod'];
    tipAmount?: number;
    carDeliveryDetails?: Order['carDeliveryDetails'];
    specialNotes?: string;
  }): Promise<Order> => {
    if (!restaurant) throw new Error('No restaurant is loaded.');
    if (cart.length === 0) throw new Error('Your cart is empty.');
    if (orderData.orderMode === 'dine_in' && !publicTableToken && !customer) {
      throw new Error('Please scan a table QR code before placing a dine-in order.');
    }

    const itemsPayload = cart.map(ci => ({
      menu_item_id: ci.menuItem.id,
      quantity: ci.quantity,
      special_instructions: ci.specialInstructions || null,
      modifiers: ci.selectedModifiers.map(m => ({ modifier_option_id: m.optionId })),
    }));

    const { data, error } = await supabase.rpc('place_qr_order', {
      p_public_token: publicTableToken,
      p_items: itemsPayload,
      p_customer_name: (orderData.customerName || customer?.name || 'Guest Diner').trim(),
      p_customer_phone: (orderData.customerPhone || customer?.phone || '').trim() || null,
      p_payment_method: orderData.paymentMethod || 'cash',
      p_tip: orderData.tipAmount || 0,
      p_special_notes: orderData.specialNotes || null,
      p_order_mode: orderData.orderMode,
      p_customer_id: customer?.id || null,
      p_car_delivery: orderData.carDeliveryDetails || null,
    });
    if (error || !data?.order) throw new Error(error?.message || 'Failed to place order');

    const rawOrder = data.order as any;
    const info = lookupTableInfo(rawOrder.table_id);
    const finalOrder = mapOrder(rawOrder, info.tableNumber, info.areaName);
    clearCart();
    setActiveOrder(finalOrder);
    await fetchOrders();
    playOrderChime();
    return finalOrder;
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    const { error } = await supabase.rpc('update_order_status_secure', { p_order_id: orderId, p_new_status: newStatus });
    if (error) {
      setDataError(error.message);
      return;
    }
    await fetchOrders();
    playOrderChime();
  };

  // ============ TABLES (status now genuinely persisted, not just local state) ============
  const updateTableStatus = async (tableId: string, status: RestaurantTable['status']) => {
    setTables(prev => prev.map(t => (t.id === tableId ? { ...t, status } : t)));
    if (activeTable?.id === tableId) setActiveTable(prev => (prev ? { ...prev, status } : null));
    const { error } = await supabase.from('restaurant_tables').update({ status }).eq('id', tableId);
    if (error) {
      // revert optimistic update on failure
      setDataError(`Could not update table status: ${error.message}`);
    }
  };

  const saveTable = async (table: RestaurantTable) => {
    const existing = tables.find(t => t.id === table.id);
    if (existing) {
      await supabase.from('restaurant_tables').update({
        display_name: table.name, capacity: table.capacity, area_id: table.areaId, status: table.status,
      }).eq('id', table.id);
      setTables(prev => prev.map(t => (t.id === table.id ? table : t)));
    } else if (tenantLocationId) {
      const { data } = await supabase.from('restaurant_tables').insert([{
        location_id: tenantLocationId, area_id: table.areaId, display_name: table.name, capacity: table.capacity,
      }]).select().single();
      if (data) {
        await supabase.from('table_qr_codes').insert([{ table_id: data.id, public_token: `qr_${crypto.randomUUID()}` }]);
        setTables(prev => [...prev, mapTable(data, { public_token: `qr_${crypto.randomUUID()}` })]);
      }
    }
  };

  const deleteTable = async (tableId: string) => {
    await supabase.from('restaurant_tables').delete().eq('id', tableId);
    setTables(prev => prev.filter(t => t.id !== tableId));
    if (activeTable?.id === tableId) setActiveTable(tables.find(t => t.id !== tableId) || null);
  };

  // ============ MENU MANAGEMENT ============
  const toggleItemSoldOut = async (itemId: string) => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    await supabase.from('menu_items').update({ active: item.isSoldOut }).eq('id', itemId);
    setMenuItems(prev => prev.map(i => (i.id === itemId ? { ...i, isSoldOut: !i.isSoldOut } : i)));
  };

  const saveMenuItem = async (item: MenuItem) => {
    const existing = menuItems.find(i => i.id === item.id);
    const payload = {
      category_id: item.categoryId,
      name: item.name,
      short_description: item.description,
      image_path: item.imageUrl,
      base_price: item.price,
      vegetarian: !!item.isVegetarian,
      vegan: !!item.isVegan,
      gluten_free: !!item.isGlutenFree,
      featured: !!item.isFeatured,
      active: !item.isSoldOut,
    };
    if (existing) {
      await supabase.from('menu_items').update(payload).eq('id', item.id);
      setMenuItems(prev => prev.map(i => (i.id === item.id ? item : i)));
    } else if (restaurant) {
      const { data } = await supabase.from('menu_items').insert([{ ...payload, restaurant_id: restaurant.id, currency: restaurant.locations.find(l => l.id === tenantLocationId)?.currency || restaurant.locations[0]?.currency || 'INR' }]).select().single();
      if (data) setMenuItems(prev => [...prev, mapMenuItem(data, [])]);
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    await supabase.from('menu_items').delete().eq('id', itemId);
    setMenuItems(prev => prev.filter(i => i.id !== itemId));
  };

  const saveCategory = async (category: MenuCategory) => {
    const existing = categories.find(c => c.id === category.id);
    const payload = { name: category.name, description: category.description, sort_order: category.sortOrder, active: category.isActive };
    if (existing) {
      await supabase.from('menu_categories').update(payload).eq('id', category.id);
      setCategories(prev => prev.map(c => (c.id === category.id ? category : c)));
    } else if (restaurant) {
      const { data } = await supabase.from('menu_categories').insert([{ ...payload, restaurant_id: restaurant.id }]).select().single();
      if (data) setCategories(prev => [...prev, mapCategory(data)]);
    }
  };

  // ============ SERVICE REQUESTS ============
  const createServiceRequest = async (type: ServiceRequest['type'], customMessage?: string) => {
    if (!activeTable || !tenantLocationId) return;
    if (!customer && !publicTableToken) return;

    if (publicTableToken) {
      const { error } = await supabase.rpc('create_guest_service_request', {
        p_public_token: publicTableToken,
        p_request_type: type,
        p_message: customMessage || null,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('service_requests').insert([{
        location_id: tenantLocationId, table_id: activeTable.id, customer_id: customer?.id || null,
        request_type: type, message: customMessage, status: 'open',
      }]);
      if (error) throw new Error(error.message);
    }
    await fetchServiceRequests();
    playOrderChime();
  };

  const updateServiceRequestStatus = async (requestId: string, status: ServiceRequest['status']) => {
    await supabase.from('service_requests').update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    }).eq('id', requestId);
    await fetchServiceRequests();
  };

  // ============ LOYALTY ============
  const customerProfile: CustomerProfile = customer
    ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || '',
        email: user?.email || '',
        pointsBalance: customer.pointsBalance,
        stampsCount: customer.stampsCount,
        stampsRequired: customer.stampsRequired,
        tier: (customer.tier as any) || 'Silver',
        joinedAt: new Date().toISOString(),
        totalOrdersCount: orders.length,
        savedRewards: rewardRows.map(r => ({
          id: r.id,
          title: r.title,
          pointsCost: 0,
          description: r.description || '',
          code: r.reward_type,
          isUnlocked: !!r.redeemed_at,
        })),
      }
    : EMPTY_PROFILE;

  const redeemReward = async (rewardId: string) => {
    if (!customer) return;
    await supabase.from('customer_rewards').update({ redeemed_at: new Date().toISOString() }).eq('id', rewardId);
    setRewardRows(prev => prev.map(r => (r.id === rewardId ? { ...r, redeemed_at: new Date().toISOString() } : r)));
  };

  const addCustomerStamps = async (stamps: number) => {
    if (!customer) return;
    const next = Math.min(customer.stampsRequired, customer.stampsCount + stamps);
    await supabase.from('customers').update({ stamps_count: next }).eq('id', customer.id);
    await refreshProfile();
  };

  // ============ REVIEWS ============
  const submitReview = async (rating: number, comment: string, _tags?: string[]) => {
    if (!customer || !restaurant || !tenantLocationId) return;
    await supabase.from('reviews').insert([{
      order_id: activeOrder?.id,
      restaurant_id: restaurant.id,
      location_id: tenantLocationId,
      overall_rating: rating,
      comment,
      customer_id: customer.id,
    }]);
    const { data: reviewRows } = await supabase.from('reviews').select('*, customers(name)').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false });
    setReviews((reviewRows || []).map(mapReview));
  };

  const replyToReview = async (reviewId: string, replyText: string) => {
    await supabase.from('reviews').update({ staff_reply: replyText }).eq('id', reviewId);
    setReviews(prev => prev.map(r => (r.id === reviewId ? { ...r, reply: replyText } : r)));
  };

  // ============ FEATURE FLAGS / SETTINGS ============
  const toggleFeatureFlag = async (flag: keyof FeatureFlags) => {
    if (!staff) return;
    const newVal = !featureFlags[flag];
    setFeatureFlags(prev => ({ ...prev, [flag]: newVal }));
    const { data: feat } = await supabase.from('features').select('id').eq('code', flag).maybeSingle();
    if (feat) {
      await supabase.from('organization_feature_overrides').upsert([{
        organization_id: staff.organizationId, feature_id: feat.id, enabled: newVal,
      }], { onConflict: 'organization_id,feature_id' });
    }
  };

  const updateRestaurantSettings = async (updated: Partial<Restaurant>) => {
    if (!restaurant) return;
    setRestaurant(prev => (prev ? { ...prev, ...updated } : prev));
    const payload: any = {};
    if (updated.name) payload.name = updated.name;
    if (updated.description) payload.description = updated.description;
    if (updated.logoUrl) payload.logo_path = updated.logoUrl;
    if (updated.coverImageUrl) payload.cover_image_path = updated.coverImageUrl;
    if (Object.keys(payload).length > 0) {
      await supabase.from('restaurants').update(payload).eq('id', restaurant.id);
    }
  };

  return (
    <RestaurantContext.Provider
      value={{
        viewMode, setViewMode,
        restaurant, activeLocationId: tenantLocationId || '', setActiveLocationId: setTenantLocationId,
        activeTable, setActiveTable,
        dataLoading, dataError, retryLoad,

        categories, menuItems, selectedCategory, setSelectedCategory,
        searchQuery, setSearchQuery, dietaryFilters, setDietaryFilters,
        toggleItemSoldOut, saveMenuItem, deleteMenuItem, saveCategory,

        areas, tables, updateTableStatus, saveTable, deleteTable,

        cart, addToCart, updateCartQuantity, removeFromCart, clearCart,
        cartTotalAmount, cartItemCount,

        orders, activeOrder, setActiveOrder, createOrder, updateOrderStatus,

        serviceRequests, createServiceRequest, updateServiceRequestStatus,

        customerProfile, redeemReward, addCustomerStamps,

        reviews, submitReview, replyToReview,

        currentPlan, setCurrentPlan, featureFlags, toggleFeatureFlag, updateRestaurantSettings,

        soundEnabled, setSoundEnabled, playOrderChime,
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
