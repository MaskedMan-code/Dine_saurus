import { MENU_IMAGE_PLACEHOLDER } from '../../lib/placeholder';
import React, { useRef, useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { MenuItem, RestaurantTable } from '../../types';
import {
  LayoutGrid,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Banknote,
  Split,
  Utensils,
  ShoppingBag,
  Car,
  User,
  Sparkles,
  ChevronRight,
  Receipt,
} from 'lucide-react';

export const POSView: React.FC = () => {
  const { restaurant, categories, menuItems, tables, activeTable, setActiveTable, createOrder } =
    useRestaurant();

  const [posCategory, setPosCategory] = useState<string>('cat_popular');
  const [posSearch, setPosSearch] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>(
    activeTable?.id || tables[0]?.id || '',
  );
  const [guestName, setGuestName] = useState<string>('Walk-in Diner');
  const [posItems, setPosItems] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [splitCount, setSplitCount] = useState<number>(1);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [guestPhone, setGuestPhone] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const orderIntent = useRef(crypto.randomUUID());
  const [lastOrderNum, setLastOrderNum] = useState<string>('');

  if (!restaurant) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6b6b6b]">
        No restaurant loaded.
      </div>
    );
  }

  const currentTable = tables.find((t) => t.id === selectedTableId);

  const filteredMenuItems = menuItems.filter((item) => {
    if (posSearch.trim()) {
      const q = posSearch.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    if (posCategory === 'cat_popular') return true;
    return item.categoryId === posCategory;
  });

  const addItemToPOS = (item: MenuItem) => {
    if (item.isSoldOut || submitLock.current) return;
    setPosItems((prev) => {
      const idx = prev.findIndex((p) => p.item.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    if (submitLock.current) return;
    setPosItems((prev) =>
      prev
        .map((p) => {
          if (p.item.id === itemId) {
            const newQty = p.quantity + delta;
            return newQty > 0 ? { ...p, quantity: newQty } : null;
          }
          return p;
        })
        .filter((p): p is { item: MenuItem; quantity: number } => p !== null),
    );
  };

  const removeItem = (itemId: string) => {
    if (submitLock.current) return;
    setPosItems((prev) => prev.filter((p) => p.item.id !== itemId));
  };

  const rawSubtotal = posItems.reduce((sum, p) => sum + p.item.price * p.quantity, 0);
  const discountAmount = Number(((rawSubtotal * discountPercent) / 100).toFixed(2));
  const discountedSubtotal = rawSubtotal - discountAmount;
  const taxAmount = Number(((discountedSubtotal * restaurant.taxRatePercent) / 100).toFixed(2));
  const serviceCharge = Number(
    ((discountedSubtotal * restaurant.serviceChargePercent) / 100).toFixed(2),
  );
  const grandTotal = Number((discountedSubtotal + taxAmount + serviceCharge).toFixed(2));
  const perPersonSplit = Number((grandTotal / splitCount).toFixed(2));

  const handleSendOrder = async (paymentMethod: 'card' | 'cash') => {
    if (!posItems.length || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (discountPercent !== 0) throw new Error('Discounts are not enabled for QR orders.');
      const order = await createOrder({
        orderMode: 'dine_in',
        customerName: guestName,
        customerPhone: guestPhone,
        paymentMethod,
        tableId: selectedTableId,
        items: posItems.map((p) => ({
          id: `${orderIntent.current}:${p.item.id}`,
          menuItem: p.item,
          quantity: p.quantity,
          selectedModifiers: [],
          unitPrice: p.item.price,
          totalPrice: p.item.price * p.quantity,
        })),
      });
      setLastOrderNum(order.orderNumber);
      setIsSuccessModalOpen(true);
      setPosItems([]);
      setDiscountPercent(0);
      orderIntent.current = crypto.randomUUID();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not confirm this order. Please retry.',
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {submitError && (
        <p role="alert" className="p-3 bg-red-50 text-red-700">
          {submitError}
        </p>
      )}
      <label className="block text-sm mb-3">
        Diner mobile (required)
        <input
          type="tel"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          className="ml-3 p-2 border rounded-lg"
        />
      </label>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Categories & Quick Food Grid */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-grow w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
                placeholder="Search food by code or keyword..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Table:</span>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none w-full sm:w-40 cursor-pointer"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.capacity} Seats - {t.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Categories Horizontal */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setPosCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  posCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Grid of Dishes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {filteredMenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.isSoldOut}
                onClick={() => addItemToPOS(item)}
                className={`p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-left flex flex-col justify-between group transition-all cursor-pointer ${
                  item.isSoldOut
                    ? 'opacity-50 grayscale cursor-not-allowed'
                    : 'hover:border-indigo-500 hover:shadow-md active:scale-[0.98]'
                }`}
              >
                <div className="relative h-24 w-full rounded-lg overflow-hidden mb-2 bg-slate-100">
                  <img
                    src={item.imageUrl || MENU_IMAGE_PLACEHOLDER}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = MENU_IMAGE_PLACEHOLDER;
                    }}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  {item.isSoldOut && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                      <span className="text-[10px] uppercase font-bold text-white px-2 py-0.5 rounded bg-slate-900/80">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-indigo-600">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{item.description}</p>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                  <span className="font-bold text-xs text-slate-900">
                    {restaurant.currencySymbol}
                    {item.price.toFixed(2)}
                  </span>
                  <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center group-hover:bg-indigo-700">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right 5 Columns: POS Order Cart & Checkout Terminal */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Active Cashier Ticket</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentTable?.name || 'Table'} • {restaurant.name}
              </p>
            </div>
            <button
              onClick={() => setPosItems([])}
              className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              Clear Ticket
            </button>
          </div>

          {/* Guest Name input */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name (e.g. John Doe)"
              className="w-full text-xs bg-transparent focus:outline-none text-slate-900 font-medium"
            />
          </div>

          {/* Items List */}
          <div className="p-4 overflow-y-auto max-h-72 space-y-2 divide-y divide-slate-100 flex-grow">
            {posItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-1">
                <LayoutGrid className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No items added to ticket yet</p>
                <p className="text-[11px]">Click items from the catalog on the left to add.</p>
              </div>
            ) : (
              posItems.map((p) => (
                <div
                  key={p.item.id}
                  className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex-grow">
                    <h5 className="font-bold text-slate-900">{p.item.name}</h5>
                    <p className="text-slate-500">
                      {restaurant.currencySymbol}
                      {p.item.price.toFixed(2)} each
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-md p-0.5 border border-slate-200">
                      <button
                        onClick={() => updateQuantity(p.item.id, -1)}
                        className="w-5 h-5 flex items-center justify-center font-bold hover:bg-white rounded cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold text-xs">{p.quantity}</span>
                      <button
                        onClick={() => updateQuantity(p.item.id, 1)}
                        className="w-5 h-5 flex items-center justify-center font-bold hover:bg-white rounded cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-bold text-slate-900 w-14 text-right">
                      {restaurant.currencySymbol}
                      {(p.item.price * p.quantity).toFixed(2)}
                    </span>

                    <button
                      onClick={() => removeItem(p.item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Calculation & Bill Split Tools */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 text-xs">
            {/* Split & Discount controls */}
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px]">Discount:</span>
                <select
                  disabled
                  title="Server discounts are not configured"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="bg-white border border-slate-200 p-1 rounded-md text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={10}>10% Staff</option>
                  <option value={15}>15% Promo</option>
                  <option value={20}>20% VIP</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 justify-end">
                <Split className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 text-[11px]">Split:</span>
                <select
                  value={splitCount}
                  onChange={(e) => setSplitCount(Number(e.target.value))}
                  className="bg-white border border-slate-200 p-1 rounded-md text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value={1}>1 Way</option>
                  <option value={2}>2 Guests</option>
                  <option value={3}>3 Guests</option>
                  <option value={4}>4 Guests</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>
                {restaurant.currencySymbol}
                {rawSubtotal.toFixed(2)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-600 font-medium">
                <span>Discount ({discountPercent}%)</span>
                <span>
                  -{restaurant.currencySymbol}
                  {discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Taxes ({restaurant.taxRatePercent}%)</span>
              <span>
                {restaurant.currencySymbol}
                {taxAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Service ({restaurant.serviceChargePercent}%)</span>
              <span>
                {restaurant.currencySymbol}
                {serviceCharge.toFixed(2)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
              <span>Grand Total</span>
              <span>
                {restaurant.currencySymbol}
                {grandTotal.toFixed(2)}
              </span>
            </div>

            {splitCount > 1 && (
              <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 flex justify-between font-semibold text-xs text-indigo-900">
                <span>Per Person ({splitCount} ways):</span>
                <span>
                  {restaurant.currencySymbol}
                  {perPersonSplit.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Checkout Triggers */}
          <div className="p-4 bg-white border-t border-slate-200 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={posItems.length === 0 || submitting}
                onClick={() => handleSendOrder('card')}
                className="py-2.5 px-4 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Order ? card at restaurant</span>
              </button>

              <button
                disabled={posItems.length === 0 || submitting}
                onClick={() => handleSendOrder('cash')}
                className="py-2.5 px-4 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Banknote className="w-4 h-4" />
                <span>Order ? cash at restaurant</span>
              </button>
            </div>

            <button
              onClick={() => window.print()}
              disabled={posItems.length === 0 || submitting}
              className="w-full py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Preview Slip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Order {lastOrderNum} Transmitted!
            </h3>
            <p className="text-xs text-slate-500">
              Ticket sent directly to Kitchen Display System and table marked occupied.
            </p>
            <button
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold text-xs hover:bg-indigo-700 cursor-pointer"
            >
              Start Next Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
