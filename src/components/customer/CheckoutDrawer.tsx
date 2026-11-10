import React, { useState, useEffect, useRef } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { OrderMode } from '../../types';
import {
  X,
  Utensils,
  ShoppingBag,
  Car,
  CreditCard,
  DollarSign,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { orderTotals } from '../../lib/money';
import { validateGuest } from '../../lib/ordering';
import { readJson, writeStorage } from '../../lib/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced: (orderId: string) => void;
}

export const CheckoutDrawer: React.FC<Props> = ({ isOpen, onClose, onOrderPlaced }) => {
  const {
    restaurant,
    activeTable,
    cart,
    updateCartQuantity,
    removeFromCart,
    cartTotalAmount,
    createOrder,
    customerProfile,
  } = useRestaurant();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitLock.current) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const [orderMode, setOrderMode] = useState<OrderMode>('dine_in');
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash'>('cash');
  const draftKey = `dinesaurus:checkout:${restaurant?.id}:${activeTable?.id}`;
  const draft = readJson<{ name?: string; phone?: string; notes?: string }>(draftKey, {});
  const [customerName, setCustomerName] = useState<string>(
    draft.name || (customerProfile.id ? customerProfile.name : ''),
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    draft.phone || customerProfile.phone || '',
  );
  const [specialNotes, setSpecialNotes] = useState<string>(draft.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitLock = useRef(false);
  useEffect(() => {
    writeStorage(
      draftKey,
      JSON.stringify({ name: customerName, phone: customerPhone, notes: specialNotes }),
      'session',
    );
  }, [draftKey, customerName, customerPhone, specialNotes]);

  // Car delivery details
  const [vehicleModel, setVehicleModel] = useState<string>('');
  const [registrationNumber, setRegistrationNumber] = useState<string>('');
  const [vehicleColor, setVehicleColor] = useState<string>('');
  const [parkingSpotNumber, setParkingSpotNumber] = useState<string>('');

  if (!restaurant) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6b6b6b]">
        No restaurant loaded.
      </div>
    );
  }

  if (!isOpen) return null;
  const close = () => {
    if (!submitLock.current) onClose();
  };

  const { subtotal, taxAmount, serviceCharge, tipAmount, grandTotal } = orderTotals(
    cartTotalAmount,
    restaurant.taxRatePercent,
    restaurant.serviceChargePercent,
    0,
  );

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || submitLock.current) return;
    const validation = validateGuest(customerName, customerPhone);
    if (validation) {
      setSubmitError(validation);
      return;
    }
    submitLock.current = true;
    setSubmitError(null);

    setIsSubmitting(true);
    try {
      const newOrder = await createOrder({
        orderMode,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        paymentMethod,
        tipAmount,
        specialNotes: specialNotes.trim() || undefined,
        carDeliveryDetails:
          orderMode === 'car_delivery'
            ? {
                vehicleModel,
                registrationNumber,
                color: vehicleColor,
                parkingSpotNumber,
                contactPhone: customerPhone,
              }
            : undefined,
      });

      // Confetti celebratory burst
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#16342b', '#c8eadc', '#8d4e2d', '#fdaa83'],
      });

      writeStorage(draftKey, null, 'session');
      onClose();
      onOrderPlaced(newOrder.id);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Your order could not be confirmed. Your cart is saved; please retry.',
      );
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="bg-[#fcfcfb] w-full max-w-lg min-h-0 rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-[#ebebe8] animate-in slide-in-from-bottom duration-200"
      >
        {/* Header */}
        <div className="p-4 shrink-0 border-b border-[#ebebe8] flex items-center justify-between bg-[#fcfcfb]">
          <div>
            <h3 id="checkout-title" className="font-bold text-base text-[#16342b]">
              Checkout & Order
            </h3>
            <p className="text-xs text-[#70706b]">
              {activeTable
                ? `Table ${activeTable.tableNumber} • ${restaurant.name}`
                : restaurant.name}
            </p>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full bg-[#f4f4f2] text-[#242424] flex items-center justify-center hover:bg-[#ebebe8] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          role="region"
          aria-label="Checkout details"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <fieldset disabled={isSubmitting} className="min-w-0 p-5 space-y-5">
            {/* Phase 2 ordering mode: QR dine-in */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#70706b] mb-2">
                Ordering Mode
              </label>
              <div className="p-3 rounded-xl bg-[#f4f4f2] border border-[#ebebe8]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#16342b]">
                  <Utensils className="w-4 h-4" />
                  Dine-in via table QR
                </div>
                <p className="text-[11px] text-[#70706b] mt-1">
                  The QR code identifies your table automatically.
                </p>
              </div>
            </div>

            {/* Cart Item Summary */}
            <div className="bg-[#f4f4f2] p-4 rounded-xl border border-[#ebebe8] space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#70706b]">
                  Your Selection
                </h4>
                <span className="text-xs font-bold text-[#16342b]">
                  {cart.length} {cart.length === 1 ? 'dish' : 'dishes'}
                </span>
              </div>

              <div className="divide-y divide-[#ebebe8] max-h-48 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#242424]">{item.menuItem.name}</span>
                        <span className="text-[11px] text-[#70706b]">x{item.quantity}</span>
                      </div>
                      {item.menuItem.isSoldOut && (
                        <p className="text-red-700 text-xs">
                          Unavailable — remove this item before ordering.
                        </p>
                      )}
                      {item.selectedModifiers.length > 0 && (
                        <p className="text-[10px] text-[#70706b]">
                          {item.selectedModifiers.map((m) => m.optionName).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[#16342b]">
                        {restaurant.currencySymbol}
                        {item.totalPrice.toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-[#70706b] hover:text-[#8d4e2d] transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Guest Contact Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#70706b]">
                Diner Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    className="block text-[11px] font-semibold text-[#16342b] mb-1"
                    htmlFor="guest-name"
                  >
                    Full name (required)
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    required
                    maxLength={120}
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full p-2.5 rounded-xl bg-[#f4f4f2] border border-[#ebebe8] text-xs text-[#242424] focus:outline-none focus:bg-[#fcfcfb] focus:border-[#16342b]"
                  />
                </div>
                <div>
                  <label
                    className="block text-[11px] font-semibold text-[#16342b] mb-1"
                    htmlFor="guest-mobile"
                  >
                    Mobile number (required)
                  </label>
                  <input
                    id="guest-mobile"
                    type="tel"
                    required
                    maxLength={24}
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Mobile with country code"
                    className="w-full p-2.5 rounded-xl bg-[#f4f4f2] border border-[#ebebe8] text-xs text-[#242424] focus:outline-none focus:bg-[#fcfcfb] focus:border-[#16342b]"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-[#70706b]">
              Your mobile number is unverified and is used for this order. Keep this device to track
              your order; no account or OTP is required.
            </p>
            {/* Payment preference — online payments are intentionally not charged until Phase 3. */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#70706b]">Payment</h4>
              <div className="p-3 rounded-xl bg-[#f4f4f2] border border-[#ebebe8]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#16342b]">
                  <DollarSign className="w-4 h-4" />
                  Pay at restaurant
                </div>
                <p className="text-[11px] text-[#70706b] mt-1">
                  Pay at the restaurant after placing your order. This checkout does not collect
                  payment.
                </p>
              </div>
            </div>

            {/* Bill Breakdown Summary */}
            <div className="bg-[#f4f4f2] p-4 rounded-xl border border-[#ebebe8] space-y-2 text-xs">
              <div className="flex justify-between text-[#70706b]">
                <span>Subtotal</span>
                <span>
                  {restaurant.currencySymbol}
                  {subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[#70706b]">
                <span>VAT / Tax ({restaurant.taxRatePercent}%)</span>
                <span>
                  {restaurant.currencySymbol}
                  {taxAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[#70706b]">
                <span>Service Charge ({restaurant.serviceChargePercent}%)</span>
                <span>
                  {restaurant.currencySymbol}
                  {serviceCharge.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#ebebe8] flex justify-between font-bold text-sm text-[#16342b]">
                <span>Total Amount</span>
                <span>
                  {restaurant.currencySymbol}
                  {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </fieldset>
        </div>

        {submitError && (
          <p
            role="alert"
            className="px-5 py-3 shrink-0 max-h-24 overflow-y-auto bg-red-50 text-sm text-red-700"
          >
            {submitError}
          </p>
        )}
        {/* Footer Submit Button */}
        <div className="p-4 shrink-0 bg-[#f4f4f2] border-t border-[#ebebe8]">
          <button
            disabled={cart.length === 0 || isSubmitting}
            onClick={handlePlaceOrder}
            className="w-full bg-[#16342b] text-white py-3.5 rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-[#2d4b41] disabled:opacity-50 transition-all shadow-sm flex items-center justify-between px-5 cursor-pointer"
          >
            <span>
              {isSubmitting ? 'Placing order?' : submitError ? 'Retry order' : 'Place Order'}
            </span>
            <span>
              {restaurant.currencySymbol}
              {grandTotal.toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
