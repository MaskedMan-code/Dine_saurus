export type PaperWidth = '58' | '80' | 'A4';
export interface PrintItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  instructions?: string;
  modifiers: { name: string; amount: number }[];
}
export interface OrderSnapshot {
  id: string;
  number: string;
  table?: string;
  mode: string;
  note?: string;
  created_at: string;
  accepted_at?: string;
  items: PrintItem[];
}
export interface RecordedPayment {
  id: string;
  kind: 'payment' | 'refund' | 'reversal';
  method: string;
  amount: number;
  reference?: string;
  reason?: string;
  created_at: string;
}
export interface Bill {
  id: string;
  location_id: string;
  receipt_number: string;
  currency: string;
  created_at: string;
  state: string;
  subtotal: number;
  discount: number;
  discount_reason?: string;
  tax: number;
  service_charge: number;
  tip: number;
  total: number;
  paid: number;
  received: number;
  refunded: number;
  balance: number;
  payment_status: string;
  payments: RecordedPayment[];
  snapshot: {
    brand: {
      name: string;
      logo?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      phone?: string;
      gstin?: string;
      timezone: string;
      footer?: string;
      paper_width: PaperWidth;
    };
    orders: OrderSnapshot[];
  };
}
export interface Kot {
  order_id: string;
  ticket_number: string;
  restaurant: string;
  timezone: string;
  created_at: string;
  status: string;
  snapshot: OrderSnapshot;
}
