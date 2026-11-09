import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  Award,
  Gift,
  Star,
  Users,
  Search,
  Plus,
  Sparkles,
  CheckCircle2,
  Phone,
  Mail,
  Calendar,
  Layers,
} from 'lucide-react';

export const LoyaltyAdminView: React.FC = () => {
  const { restaurant, orders } = useRestaurant();
  const { staff } = useAuth();
  const orgId = staff?.organizationId;
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId) return;
    const controller = new AbortController();
    void supabase
      .from('customers')
      .select(
        'id,name,phone,phone_verified,points_balance,stamps_count,stamps_required,tier,created_at',
      )
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (!controller.signal.aborted) {
          if (error) setError(error.message);
          else setRows(data ?? []);
        }
      });
    return () => controller.abort();
  }, [orgId, orders.length]);
  const [searchMember, setSearchMember] = useState<string>('');

  const members = rows.map((row) => {
    const visibleOrders = orders.filter(
      (order) => order.customerId === row.id && order.status !== 'cancelled',
    );
    return {
      id: row.id,
      name: row.name,
      phone: row.phone ?? '',
      email: row.phone_verified ? 'Verified contact' : 'Unverified contact',
      points: row.points_balance,
      stamps: row.stamps_count,
      stampsRequired: row.stamps_required,
      tier: row.tier,
      totalSpent:
        (restaurant?.currencySymbol ?? '') +
        visibleOrders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2),
      visits: visibleOrders.length,
    };
  });

  const filteredMembers = members.filter((m) => {
    if (searchMember.trim()) {
      const q = searchMember.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {error && (
        <p role="alert" className="p-3 bg-red-50 text-red-700">
          {error}
        </p>
      )}
      <p className="text-sm text-slate-500">
        Guest visits use unverified contact details. Matching phone numbers do not prove identity.
        Spend reflects orders visible at this location.
      </p>
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Loyalty, Rewards & Guest CRM</h2>
            <p className="text-xs text-slate-500">
              Member digital stamp cards, tier perks, point balances, and automated retention
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled
            title="Reward creation requires server setup"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium text-xs shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promo Reward</span>
          </button>
        </div>
      </div>

      {/* Program Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Active Loyalty Members</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{rows.length}</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Customer visit records</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Reward Redemption Rate</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">Not configured</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ask staff about rewards</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Points in Circulation</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {rows.reduce((sum, row) => sum + row.points_balance, 0)} pts
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Recorded customer points</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Stamp Card Goal</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">Per customer</p>
          <p className="text-[11px] text-indigo-600 font-medium mt-0.5">See recorded stamp goals</p>
        </div>
      </div>

      {/* Active Rewards Catalog & Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Program Config */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <Gift className="w-4 h-4 text-indigo-600" />
            <span>Configured Loyalty Rewards</span>
          </h3>

          <p className="text-xs text-slate-500">
            Reward redemption requires verified ownership and a server-side redemption workflow.
            Contact the restaurant administrator to configure it.
          </p>
        </div>

        {/* Member Directory */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Customer Loyalty Directory</span>
            </h3>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search member by name/phone..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Member Name</th>
                  <th className="py-2.5 px-3">Tier</th>
                  <th className="py-2.5 px-3">Points</th>
                  <th className="py-2.5 px-3">Stamps</th>
                  <th className="py-2.5 px-3">Visible order value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div>
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        <p className="text-[11px] text-slate-400">
                          {m.email} • {m.phone}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {m.tier}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{m.points} pts</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-700">
                        {m.stamps}/{m.stampsRequired} stamps
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {m.totalSpent} ({m.visits} visits)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
