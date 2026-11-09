export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
export type OrderMode = 'dine_in' | 'takeaway' | 'car_delivery' | 'token';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'billed' | 'cleaning';
export type ServiceRequestType = 'call_waiter' | 'request_bill' | 'need_water' | 'extra_cutlery' | 'clean_table' | 'other';
export type ServiceRequestStatus = 'open' | 'acknowledged' | 'resolved';

export interface DietaryTag {
  id: string;
  name: string;
  shortCode: 'V' | 'VG' | 'GF' | 'DF' | 'HALAL' | 'SPICY';
  color?: string;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  minSelections: number;
  maxSelections: number;
  required: boolean;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isFeatured?: boolean;
  isBestseller?: boolean;
  isNew?: boolean;
  isSoldOut?: boolean;
  preparationTimeMinutes?: number;
  calories?: number;
  modifierGroups?: ModifierGroup[];
  locationPrices?: Record<string, number>;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  name: string;
  areaId: string;
  capacity: number;
  status: TableStatus;
  currentSessionId?: string;
  qrCodeUrl?: string;
  publicToken: string;
  lastScannedAt?: string;
  totalOrdersCount?: number;
}

export interface RestaurantArea {
  id: string;
  name: string;
  locationId: string;
  description?: string;
  icon?: string;
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  specialInstructions?: string;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  specialInstructions?: string;
  subtotal: number;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  actor?: string;
}

export interface CarDeliveryDetails {
  vehicleModel: string;
  registrationNumber: string;
  color: string;
  parkingSpotNumber: string;
  contactPhone: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurantId: string;
  locationId: string;
  tableId?: string;
  tableNumber?: string;
  areaName?: string;
  orderMode: OrderMode;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: 'apple_pay' | 'google_pay' | 'card' | 'cash' | 'razorpay';
  publicTrackingToken?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  serviceCharge: number;
  tipAmount: number;
  totalAmount: number;
  currency: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  carDeliveryDetails?: CarDeliveryDetails;
  specialNotes?: string;
  createdAt: string;
  updatedAt: string;
  estimatedReadyMinutes?: number;
  statusHistory: OrderStatusEvent[];
}

export interface ServiceRequest {
  id: string;
  restaurantId: string;
  locationId: string;
  tableId: string;
  tableNumber: string;
  areaName: string;
  type: ServiceRequestType;
  customMessage?: string;
  status: ServiceRequestStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface CustomerReward {
  id: string;
  title: string;
  pointsCost: number;
  description: string;
  discountPercentage?: number;
  freeItemId?: string;
  code: string;
  isUnlocked: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  pointsBalance: number;
  stampsCount: number;
  stampsRequired: number;
  tier: 'Silver' | 'Gold' | 'Platinum' | 'Nordic Club';
  joinedAt: string;
  totalOrdersCount: number;
  savedRewards: CustomerReward[];
}

export interface Review {
  id: string;
  orderId?: string;
  tableNumber?: string;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  itemFeedbackTags?: string[];
  createdAt: string;
  reply?: string;
}

export interface RestaurantLocation {
  id: string;
  restaurantId: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  currency: string;
  timezone: string;
  isOpen: boolean;
  openingHours: string;
}

export interface Restaurant {
  id: string;
  organizationId: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  coverImageUrl: string;
  cuisineType: string;
  rating: number;
  totalReviews: number;
  avgPreparationTime: string;
  currencySymbol: string;
  currencyCode: string;
  primaryColor: string;
  taxRatePercent: number;
  serviceChargePercent: number;
  locations: RestaurantLocation[];
}

export interface SaaSPlan {
  id: 'free' | 'starter' | 'growth' | 'enterprise';
  name: string;
  priceMonthly: number;
  currency: string;
  features: string[];
  maxLocations: number;
  maxTables: number;
  orderLimitMonthly: number;
}

export interface FeatureFlags {
  qrOrdering: boolean;
  kitchenDisplay: boolean;
  carDelivery: boolean;
  loyaltyProgram: boolean;
  serviceRequests: boolean;
  advancedAnalytics: boolean;
  multiLocation: boolean;
  inventoryTracking: boolean;
}
