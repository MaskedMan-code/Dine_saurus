import React, { useEffect } from 'react';
import { Order, OrderStatus } from '../../types';
import { X, CheckCircle2, Clock, ChefHat, Bell, Utensils, Sparkles, MapPin } from 'lucide-react';

interface Props {
  isOpen: boolean;
  order: Order | null;
  currency: string;
  onClose: () => void;
  onRequestService: () => void;
}

export const OrderTrackerModal: React.FC<Props> = ({
  isOpen,
  order,
  currency,
  onClose,
  onRequestService,
}) => {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const steps: { key: OrderStatus; label: string; description: string; icon: React.ReactNode }[] = [
    {
      key: 'pending',
      label: 'Order Received',
      description: 'Transmitted to kitchen terminal',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      key: 'accepted',
      label: 'Kitchen Accepted',
      description: 'Head chef queued ticket',
      icon: <ChefHat className="w-4 h-4" />,
    },
    {
      key: 'preparing',
      label: 'Cooking & Crafting',
      description: 'Freshly preparing your dishes',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      key: 'ready',
      label: 'Plated & Ready',
      description: 'Expedited for table service',
      icon: <Bell className="w-4 h-4" />,
    },
    {
      key: 'served',
      label: 'Served to Table',
      description: 'Bon appétit!',
      icon: <Utensils className="w-4 h-4" />,
    },
  ];

  const statusOrder: OrderStatus[] = [
    'pending',
    'accepted',
    'preparing',
    'ready',
    'served',
    'completed',
  ];
  const currentIndex = statusOrder.indexOf(order.status);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#fcfcfb] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-[#ebebe8] flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-[#16342b] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#2d4b41] text-[#99baad] border border-[#3e6357]">
              Live Tracker
            </span>
            <span className="text-xs text-[#99baad]">Updates every few seconds</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Order {order.orderNumber}
          </h2>
          <div className="flex items-center gap-2 text-xs text-[#c8eadc] mt-1">
            <MapPin className="w-3.5 h-3.5 text-[#fdaa83]" />
            <span>
              {order.orderMode === 'dine_in'
                ? `Table ${order.tableNumber || '?'} (${order.areaName || 'Table service'})`
                : order.orderMode === 'car_delivery'
                  ? `Car Delivery (${order.carDeliveryDetails?.vehicleModel || 'Vehicle'})`
                  : 'Takeaway Counter'}
            </span>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="p-5 overflow-y-auto space-y-5 flex-grow">
          {/* Estimated Time Badge */}
          <div className="bg-[#f4f4f2] p-4 rounded-xl border border-[#ebebe8] flex items-center justify-between">
            <div>
              <p className="text-xs text-[#70706b]">Estimated Preparation</p>
              <p className="text-lg font-bold text-[#16342b]">
                {order.status === 'completed' || order.status === 'served'
                  ? 'Completed ✨'
                  : order.status === 'ready'
                    ? 'Ready for You!'
                    : order.status === 'cancelled'
                      ? 'Cancelled'
                      : order.estimatedReadyMinutes
                        ? `${order.estimatedReadyMinutes} min (restaurant estimate)`
                        : 'Awaiting kitchen estimate'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#e8e8e6] text-[#16342b] flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-[#8d4e2d]" />
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-4 relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[#ebebe8]"></div>

            {steps.map((step) => {
              const isPastOrCurrent = currentIndex >= statusOrder.indexOf(step.key);
              const isCurrent = order.status === step.key;

              return (
                <div key={step.key} className="flex items-start gap-4 relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 font-bold text-xs transition-colors shadow-sm ${
                      isCurrent
                        ? 'bg-[#16342b] text-white ring-4 ring-[#16342b]/15'
                        : isPastOrCurrent
                          ? 'bg-[#2d4b41] text-white'
                          : 'bg-[#fcfcfb] border-2 border-[#ebebe8] text-[#70706b]'
                    }`}
                  >
                    {step.icon}
                  </div>

                  <div className="flex-grow pt-0.5">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-sm font-semibold ${
                          isPastOrCurrent ? 'text-[#16342b]' : 'text-[#70706b]'
                        }`}
                      >
                        {step.label}
                      </h4>
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c8eadc] text-[#16342b]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#70706b] mt-0.5">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ordered Items Summary */}
          <div className="bg-[#f4f4f2] p-4 rounded-xl border border-[#ebebe8] space-y-2">
            <h4 className="font-semibold text-xs text-[#70706b] uppercase tracking-wider">
              Dishes in this Ticket
            </h4>
            <div className="divide-y divide-[#ebebe8] text-xs">
              {order.items.map((item) => (
                <div key={item.id} className="py-2 first:pt-0 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-[#242424]">
                      {item.quantity}x {item.itemNameSnapshot}
                    </span>
                    {item.selectedModifiers.length > 0 && (
                      <p className="text-[11px] text-[#70706b]">
                        {item.selectedModifiers.map((m) => m.optionName).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-[#16342b]">
                    {currency}
                    {item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-[#ebebe8] flex justify-between text-xs font-bold text-[#16342b]">
              <span>Total Paid</span>
              <span>
                {currency}
                {order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#f4f4f2] border-t border-[#ebebe8] flex gap-2">
          <button
            onClick={onRequestService}
            className="flex-1 bg-[#fcfcfb] border border-[#ebebe8] text-[#16342b] py-3 rounded-xl text-xs font-semibold hover:bg-[#ebebe8] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Bell className="w-3.5 h-3.5 text-[#16342b]" />
            <span>Call Waiter / Service</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-[#16342b] text-white py-3 rounded-xl text-xs font-semibold hover:bg-[#2d4b41] transition-colors cursor-pointer shadow-sm"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
