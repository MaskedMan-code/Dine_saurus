import React from 'react';
import { FinancialOverview } from './FinancialOverview';
import { useAuth } from '../../context/AuthContext';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Clock,
  Users,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  QrCode,
  Sparkles,
  PieChart as PieChartIcon,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { staff } = useAuth();
  const { restaurant, orders, tables, reviews } = useRestaurant();

  if (!restaurant) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6b6b6b]">
        No restaurant loaded.
      </div>
    );
  }

  // Aggregate metrics
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.status !== 'cancelled' ? o.totalAmount : 0),
    0,
  );
  const completedOrders = orders.filter((o) => o.status === 'completed' || o.status === 'served');
  const avgOrderValue =
    completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => sum + o.totalAmount, 0) / completedOrders.length
      : 0;
  const share = (count: number) => (orders.length ? Math.round((count * 100) / orders.length) : 0);
  const dishes = Object.values(
    orders
      .filter((o) => o.status !== 'cancelled')
      .flatMap((o) => o.items)
      .reduce(
        (
          acc: Record<string, { id: string; name: string; quantity: number; revenue: number }>,
          item,
        ) => {
          const row = acc[item.menuItemId] ?? {
            id: item.menuItemId,
            name: item.itemNameSnapshot,
            quantity: 0,
            revenue: 0,
          };
          row.quantity += item.quantity;
          row.revenue += item.subtotal;
          acc[item.menuItemId] = row;
          return acc;
        },
        {},
      ),
  )
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const qrOrderCount = orders.filter((o) => o.orderMode === 'dine_in').length;
  const takeawayCount = orders.filter((o) => o.orderMode === 'takeaway').length;
  const carDeliveryCount = orders.filter((o) => o.orderMode === 'car_delivery').length;

  const avgReviewScore =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 'No ratings';

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {staff && ['owner', 'admin', 'manager'].includes(staff.role) && <FinancialOverview />}
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Executive Restaurant Analytics</h2>
            <p className="text-xs text-slate-500">
              Live sales performance, QR table turnaround metrics, and revenue breakdown
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 font-medium text-slate-700">
            Selected location ? loaded orders
          </span>
          <button
            disabled
            title="CSV export is not configured"
            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Order value (excluding cancellations)
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {restaurant.currencySymbol}
              {totalRevenue.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Based on loaded orders</p>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Guest Orders</span>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{orders.length}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Orders visible to your account</p>
        </div>

        {/* Avg Order Value */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Avg Ticket Size (AOV)</span>
            <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {restaurant.currencySymbol}
              {avgOrderValue.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Served and completed orders</p>
        </div>

        {/* Table Turn Time */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Avg Table Turn Time</span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">Not measured</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Table session reporting is not configured
          </p>
        </div>
      </div>

      {/* Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Channels */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>Ordering Channels Breakdown</span>
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>QR Table Dine-in</span>
                <span>
                  {qrOrderCount} orders ({share(qrOrderCount)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{ width: `${share(qrOrderCount)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Takeaway Counter</span>
                <span>
                  {takeawayCount} orders ({share(takeawayCount)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${share(takeawayCount)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Curbside Car Delivery</span>
                <span>
                  {carDeliveryCount} orders ({share(carDeliveryCount)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full"
                  style={{ width: `${share(carDeliveryCount)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Contactless Digital Adoption:</span>
              <strong className="text-slate-900">Not measured</strong>
            </div>
            <div className="flex justify-between">
              <span>Avg Server Tip Rate:</span>
              <strong className="text-emerald-700">Not measured</strong>
            </div>
          </div>
        </div>

        {/* Top Performing Dishes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="font-semibold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Top Revenue Generating Dishes</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Units Sold</th>
                  <th className="py-2.5 px-3">Gross Revenue</th>
                  <th className="py-2.5 px-3">Margin</th>
                  <th className="py-2.5 px-3">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dishes.map((dish) => (
                  <tr key={dish.id}>
                    <td className="p-3">{dish.name}</td>
                    <td className="p-3">{dish.quantity}</td>
                    <td className="p-3">
                      {restaurant.currencySymbol}
                      {dish.revenue.toFixed(2)}
                    </td>
                    <td className="p-3">Not recorded</td>
                    <td className="p-3">Not recorded</td>
                  </tr>
                ))}
                {!dishes.length && (
                  <tr>
                    <td colSpan={5} className="p-4 text-slate-500">
                      No order items to report yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
