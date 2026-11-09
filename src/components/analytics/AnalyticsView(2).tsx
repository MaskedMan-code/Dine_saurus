import React from 'react';
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
  const { restaurant, orders, tables, reviews } = useRestaurant();

  if (!restaurant) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6b6b6b]">
        No restaurant loaded.
      </div>
    );
  }

  // Aggregate metrics
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.totalAmount : 0), 0);
  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'served');
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / (completedOrders.length || 1) : 0;
  const qrOrderCount = orders.filter(o => o.orderMode === 'dine_in').length;
  const takeawayCount = orders.filter(o => o.orderMode === 'takeaway').length;
  const carDeliveryCount = orders.filter(o => o.orderMode === 'car_delivery').length;

  const avgReviewScore = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '4.9';

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Executive Restaurant Analytics</h2>
            <p className="text-xs text-slate-500">Live sales performance, QR table turnaround metrics, and revenue breakdown</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 font-medium text-slate-700">Today: Live Window</span>
          <button className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer">
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Net Sales</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {restaurant.currencySymbol}{totalRevenue.toFixed(2)}
            </span>
            <span className="flex items-center text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +18.4%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">vs yesterday ($1,420.00)</p>
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
            <span className="flex items-center text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +12.1%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Avg 14.2 orders/hr</p>
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
              {restaurant.currencySymbol}{avgOrderValue.toFixed(2)}
            </span>
            <span className="flex items-center text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +6.3%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">QR upsells adding +$4.20/order</p>
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
            <span className="text-2xl font-bold text-slate-900">32 min</span>
            <span className="flex items-center text-xs font-semibold text-emerald-600">
              <ArrowDownRight className="w-3.5 h-3.5" />
              -8 min (Faster)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">QR instant checkout accelerated turns</p>
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
                <span>{qrOrderCount} orders (68%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '68%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Takeaway Counter</span>
                <span>{takeawayCount} orders (22%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '22%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Curbside Car Delivery</span>
                <span>{carDeliveryCount} orders (10%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '10%' }}></div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Contactless Digital Adoption:</span>
              <strong className="text-slate-900">92%</strong>
            </div>
            <div className="flex justify-between">
              <span>Avg Server Tip Rate:</span>
              <strong className="text-emerald-700">14.8%</strong>
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
                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-medium text-slate-900">Nordic Truffle Salmon Bowl</td>
                  <td className="py-3 px-3">48 bowls</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">$1,056.00</td>
                  <td className="py-3 px-3 text-emerald-600 font-medium">74%</td>
                  <td className="py-3 px-3">⭐ 4.9</td>
                </tr>
                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-medium text-slate-900">Artisan Sourdough Toast</td>
                  <td className="py-3 px-3">62 orders</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">$744.00</td>
                  <td className="py-3 px-3 text-emerald-600 font-medium">81%</td>
                  <td className="py-3 px-3">⭐ 4.8</td>
                </tr>
                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-medium text-slate-900">Cloudberry Espresso Tonic</td>
                  <td className="py-3 px-3">85 drinks</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">$595.00</td>
                  <td className="py-3 px-3 text-emerald-600 font-medium">88%</td>
                  <td className="py-3 px-3">⭐ 5.0</td>
                </tr>
                <tr className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-medium text-slate-900">Cardamom Brioche Knot</td>
                  <td className="py-3 px-3">54 pastries</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">$324.00</td>
                  <td className="py-3 px-3 text-emerald-600 font-medium">82%</td>
                  <td className="py-3 px-3">⭐ 4.9</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
