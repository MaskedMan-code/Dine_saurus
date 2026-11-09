import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Order } from '../../types';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Car,
  Printer,
  Sparkles,
  Volume2,
  Check,
} from 'lucide-react';

export const KitchenView: React.FC = () => {
  const { orders, updateOrderStatus, restaurant, playOrderChime } = useRestaurant();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed'>('all');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const filteredOrders = orders.filter(ord => {
    if (selectedFilter === 'all') return ord.status !== 'cancelled';
    return ord.status === selectedFilter;
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const preparingCount = orders.filter(o => o.status === 'preparing' || o.status === 'accepted').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;

  const toggleItemChecked = (itemId: string) => {
    setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const getElapsedMinutes = (dateStr: string) => {
    const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60));
    return Math.max(1, elapsed);
  };

  const handlePrintSlip = (_order: Order) => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Metrics & Action Cluster */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shadow-sm">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">Kitchen Display System (KDS)</h2>
              <p className="text-xs text-slate-500">Realtime order expediting & kitchen line terminal</p>
            </div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
            <span className="block text-xs text-amber-700 font-medium">New / Pending</span>
            <span className="text-lg font-bold text-amber-900">{pendingCount}</span>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-center">
            <span className="block text-xs text-indigo-700 font-medium">In Cooking</span>
            <span className="text-lg font-bold text-indigo-900">{preparingCount}</span>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
            <span className="block text-xs text-emerald-700 font-medium">Ready for Pass</span>
            <span className="text-lg font-bold text-emerald-900">{readyCount}</span>
          </div>

          <button
            onClick={playOrderChime}
            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Test Kitchen Chime Bell"
          >
            <Volume2 className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Chime</span>
          </button>
        </div>
      </div>

      {/* Status Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: `All Active (${orders.filter(o => o.status !== 'completed').length})` },
          { id: 'pending', label: `Pending New (${pendingCount})` },
          { id: 'preparing', label: `Preparing (${preparingCount})` },
          { id: 'ready', label: `Ready for Serving (${readyCount})` },
          { id: 'completed', label: `Completed Orders` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              selectedFilter === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tickets Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200 space-y-3">
          <ChefHat className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-base text-slate-900">No Orders in This Station</h3>
          <p className="text-xs text-slate-500">New table and QR orders will immediately pop up with audio alerts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map(order => {
            const elapsedMins = getElapsedMinutes(order.createdAt);
            const isUrgent = elapsedMins > 15 && order.status !== 'completed' && order.status !== 'ready';

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl overflow-hidden border transition-all flex flex-col shadow-sm ${
                  isUrgent
                    ? 'border-rose-500 ring-2 ring-rose-200'
                    : order.status === 'pending'
                    ? 'border-amber-400 ring-1 ring-amber-200'
                    : order.status === 'ready'
                    ? 'border-emerald-500 ring-1 ring-emerald-200'
                    : 'border-slate-200'
                }`}
              >
                {/* Ticket Top Header */}
                <div
                  className={`p-4 border-b flex items-center justify-between ${
                    order.status === 'pending'
                      ? 'bg-amber-50/70 border-amber-200'
                      : order.status === 'ready'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900">{order.orderNumber}</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          order.orderMode === 'car_delivery'
                            ? 'bg-amber-600 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {order.orderMode === 'dine_in'
                          ? `Table ${order.tableNumber || '12'}`
                          : order.orderMode === 'car_delivery'
                          ? 'Car Curbside'
                          : 'Takeaway'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {order.customerName} • {order.areaName || 'Main Dining'}
                    </p>
                  </div>

                  <div className="text-right">
                    <div
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                        isUrgent
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{elapsedMins} min</span>
                    </div>
                    <span className="block text-[10px] text-slate-500 mt-1 font-mono uppercase">
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Car Delivery Info (if applicable) */}
                {order.carDeliveryDetails && (
                  <div className="px-4 py-2 bg-amber-50/50 border-b border-amber-200 text-xs flex items-center justify-between text-amber-800">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Car className="w-3.5 h-3.5" />
                      <span>
                        {order.carDeliveryDetails.vehicleModel} ({order.carDeliveryDetails.color})
                      </span>
                    </div>
                    <span className="font-bold">{order.carDeliveryDetails.parkingSpotNumber}</span>
                  </div>
                )}

                {/* Items Checklist for Chefs */}
                <div className="p-4 space-y-3 flex-grow overflow-y-auto max-h-72">
                  <div className="divide-y divide-slate-100">
                    {order.items.map(item => {
                      const isDone = checkedItems[item.id];
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItemChecked(item.id)}
                          className={`py-2.5 first:pt-0 flex items-start gap-3 cursor-pointer select-none group transition-opacity ${
                            isDone ? 'opacity-40 line-through' : ''
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                              isDone
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white group-hover:border-indigo-500'
                            }`}
                          >
                            {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>

                          <div className="flex-grow">
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold text-sm text-slate-900">
                                {item.quantity}x {item.itemNameSnapshot}
                              </span>
                            </div>

                            {item.selectedModifiers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.selectedModifiers.map(mod => (
                                  <span
                                    key={mod.optionId}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                                  >
                                    {mod.optionName}
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.specialInstructions && (
                              <p className="text-[11px] text-indigo-700 font-medium mt-1 bg-indigo-50/70 border border-indigo-100 p-1.5 rounded-lg">
                                Note: “{item.specialInstructions}”
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {order.specialNotes && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                      <span className="font-bold text-slate-900">Order Note: </span>
                      {order.specialNotes}
                    </div>
                  )}
                </div>

                {/* Ticket Bottom Actions */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                  <button
                    onClick={() => handlePrintSlip(order)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shadow-sm"
                    title="Print Kitchen Slip"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {order.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateOrderStatus(order.id, 'accepted', 'Accepted by kitchen')}
                        className="flex-grow bg-indigo-600 text-white py-2 px-3 rounded-lg font-semibold text-xs hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Ticket</span>
                      </button>
                      <button
                        onClick={() => updateOrderStatus(order.id, 'cancelled', 'Rejected by kitchen')}
                        className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {order.status === 'accepted' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'preparing', 'On grill/stove')}
                      className="flex-grow bg-indigo-600 text-white py-2 px-3 rounded-lg font-semibold text-xs hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <ChefHat className="w-3.5 h-3.5" />
                      <span>Start Cooking</span>
                    </button>
                  )}

                  {order.status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'ready', 'Plated at expo pass')}
                      className="flex-grow bg-amber-600 text-white py-2 px-3 rounded-lg font-semibold text-xs hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Mark Ready for Pass</span>
                    </button>
                  )}

                  {order.status === 'ready' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'served', 'Delivered to table')}
                      className="flex-grow bg-emerald-600 text-white py-2 px-3 rounded-lg font-semibold text-xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Served & Complete</span>
                    </button>
                  )}

                  {order.status === 'served' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'completed', 'Order finalized')}
                      className="flex-grow bg-slate-800 text-white py-2 px-3 rounded-lg font-semibold text-xs hover:bg-slate-900 transition-colors cursor-pointer"
                    >
                      Archive Completed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
