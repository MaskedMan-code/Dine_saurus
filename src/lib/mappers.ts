import {
  Restaurant,
  RestaurantLocation,
  RestaurantArea,
  RestaurantTable,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  ModifierOption,
  Order,
  OrderItem,
  OrderStatusEvent,
  ServiceRequest,
  Review,
} from '../types';
import { locationHours } from './hours';

export function mapLocation(l: any): RestaurantLocation {
  const hours = locationHours(l.opening_hours, l.holiday_closures || [], l.timezone);
  return {
    id: l.id,
    restaurantId: l.restaurant_id,
    name: l.name,
    city: l.city || '',
    address: l.address_line_1 || '',
    phone: l.phone || '',
    currency: l.currency,
    timezone: l.timezone,
    isOpen: hours.open === true,
    openingHours: hours.label,
    openingSchedule: l.opening_hours || null,
    holidayClosures: l.holiday_closures || [],
  };
}

export function mapRestaurant(r: any, locations: any[]): Restaurant {
  const currencyCode = locations[0]?.currency || 'INR';
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
    SGD: 'S$',
    CAD: 'C$',
    AUD: 'A$',
  };
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    tagline: r.restaurant_type || '',
    description: r.description || '',
    logoUrl: r.logo_path || '',
    coverImageUrl: r.cover_image_path || '',
    cuisineType: r.restaurant_type || '',
    rating: r.rating ?? 0,
    totalReviews: r.total_reviews ?? 0,
    avgPreparationTime: r.avg_preparation_time || 'Ask staff for an estimate',
    currencySymbol: symbols[currencyCode] || currencyCode,
    currencyCode,
    primaryColor: r.primary_color || '#16342b',
    taxRatePercent: Number(r.tax_rate_percent ?? 0),
    serviceChargePercent: Number(r.service_charge_percent ?? 0),
    locations: locations.map(mapLocation),
  };
}

export function mapArea(a: any): RestaurantArea {
  return {
    id: a.id,
    name: a.name,
    locationId: a.location_id,
    description: '',
    icon: 'table_restaurant',
  };
}

export function mapTable(t: any, qr?: any): RestaurantTable {
  return {
    id: t.id,
    tableNumber: t.display_name?.replace(/[^0-9]/g, '') || t.display_name,
    name: t.display_name,
    areaId: t.area_id,
    capacity: t.capacity,
    status: t.status || 'available',
    publicToken: qr?.public_token || '',
    totalOrdersCount: qr?.scan_count || 0,
  };
}

export function mapModifierOption(o: any): ModifierOption {
  return {
    id: o.id,
    name: o.name,
    priceDelta: Number(o.price_adjustment),
    isDefault: false,
  };
}

export function mapModifierGroup(g: any, options: any[]): ModifierGroup {
  return {
    id: g.id,
    name: g.name,
    minSelections: g.minimum_selections,
    maxSelections: g.maximum_selections ?? 1,
    required: g.required,
    options: options.map(mapModifierOption),
  };
}

export function mapMenuItem(it: any, groups: ModifierGroup[], locationSetting?: any): MenuItem {
  const available = locationSetting?.available ?? true;
  const soldOut = locationSetting?.sold_out ?? false;
  const effectivePrice = locationSetting?.price_override ?? it.base_price;
  return {
    id: it.id,
    categoryId: it.category_id,
    name: it.name,
    description: it.short_description || '',
    price: Number(effectivePrice),
    basePrice: Number(it.base_price),
    currency: it.currency,
    imageUrl: it.image_path || '',
    isVegetarian: it.vegetarian,
    isVegan: it.vegan,
    isGlutenFree: it.gluten_free,
    isFeatured: it.featured,
    isActive: it.active,
    isSoldOut: !it.active || !available || soldOut,
    modifierGroups: groups,
  };
}

export function mapCategory(c: any): MenuCategory {
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    sortOrder: c.sort_order,
    isActive: c.active,
  };
}

export function mapOrderItem(oi: any): OrderItem {
  return {
    id: oi.id,
    orderId: oi.order_id,
    menuItemId: oi.menu_item_id,
    itemNameSnapshot: oi.item_name_snapshot,
    unitPriceSnapshot: Number(oi.unit_price),
    quantity: oi.quantity,
    selectedModifiers: (oi.order_item_modifiers || []).map((m: any) => ({
      groupId: '',
      groupName: '',
      optionId: m.modifier_option_id,
      optionName: m.modifier_name_snapshot,
      priceDelta: Number(m.price_adjustment),
    })),
    specialInstructions: oi.special_instructions,
    subtotal: Number(oi.line_total),
  };
}

export function mapOrder(o: any, tableNumber?: string, areaName?: string): Order {
  const statusHistory: OrderStatusEvent[] = (o.order_status_events || [])
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((e: any) => ({
      status: e.to_status,
      timestamp: e.created_at,
      note: undefined,
      actor: e.source,
    }));

  return {
    id: o.id,
    orderNumber: o.public_order_number,
    restaurantId: o.restaurant_id,
    locationId: o.location_id,
    tableId: o.table_id,
    tableNumber,
    areaName,
    orderMode: o.service_mode,
    status: o.status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    publicTrackingToken: o.public_tracking_token,
    items: (o.order_items || []).map(mapOrderItem),
    subtotal: Number(o.subtotal),
    taxAmount: Number(o.tax_total),
    discountAmount: Number(o.discount_total),
    serviceCharge: Number(o.service_charge_total),
    tipAmount: Number(o.tip_total),
    totalAmount: Number(o.grand_total),
    currency: o.currency,
    customerId: o.customer_id,
    customerName: o.customer?.name ?? o.customers?.name ?? o.customer_name,
    customerPhone: o.customer?.phone ?? o.customers?.phone ?? o.customer_phone,
    specialNotes: o.customer_note,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    estimatedReadyMinutes: o.estimated_ready_minutes,
    statusHistory,
  };
}

export function mapServiceRequest(r: any, tableNumber: string, areaName: string): ServiceRequest {
  return {
    id: r.id,
    restaurantId: '',
    locationId: r.location_id,
    tableId: r.table_id,
    tableNumber,
    areaName,
    type: r.request_type,
    customMessage: r.message,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export function mapReview(r: any): Review {
  return {
    id: r.id,
    orderId: r.order_id,
    tableNumber: undefined,
    customerName: r.customers?.name || 'Guest Diner',
    rating: r.overall_rating,
    comment: r.comment || '',
    itemFeedbackTags: [],
    createdAt: r.created_at,
    reply: r.staff_reply,
  };
}
