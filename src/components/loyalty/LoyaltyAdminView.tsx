import React, { useState } from 'react';
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
  const { restaurant, customerProfile } = useRestaurant();
  const [searchMember, setSearchMember] = useState<string>('');

  // Sample member roster for CRM
  const members = [
    {
      id: 'cust_01',
      name: customerProfile.name,
      phone: customerProfile.phone,
      email: customerProfile.email,
      points: customerProfile.pointsBalance,
      stamps: customerProfile.stampsCount,
      tier: customerProfile.tier,
      joined: '12 Jan 2024',
      totalSpent: '$482.50',
      visits: 9,
    },
    {
      id: 'cust_02',
      name: 'Freja Lindqvist',
      phone: '+46 70 891 2345',
      email: 'freja.lind@nordicmail.com',
      points: 1240,
      stamps: 6,
      tier: 'Platinum',
      joined: '04 Nov 2023',
      totalSpent: '$1,290.00',
      visits: 24,
    },
    {
      id: 'cust_03',
      name: 'Henrik Vang',
      phone: '+47 912 34 567',
      email: 'henrik.vang@oslofjord.no',
      points: 380,
      stamps: 2,
      tier: 'Silver',
      joined: '18 Feb 2024',
      totalSpent: '$195.00',
      visits: 3,
    },
    {
      id: 'cust_04',
      name: 'Astrid Olsen',
      phone: '+45 20 12 34 56',
      email: 'astrid.olsen@cphdesign.dk',
      points: 820,
      stamps: 5,
      tier: 'Gold',
      joined: '02 Jan 2024',
      totalSpent: '$640.00',
      visits: 12,
    },
  ];

  const filteredMembers = members.filter(m => {
    if (searchMember.trim()) {
      const q = searchMember.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Loyalty, Rewards & Guest CRM</h2>
            <p className="text-xs text-slate-500">Member digital stamp cards, tier perks, point balances, and automated retention</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium text-xs shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Create Promo Reward</span>
          </button>
        </div>
      </div>

      {/* Program Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Active Loyalty Members</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">1,482</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">+42 joined this week</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Reward Redemption Rate</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">68.4%</p>
          <p className="text-[11px] text-slate-400 mt-0.5">High repeat engagement</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Points in Circulation</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">142,500 pts</p>
          <p className="text-[11px] text-slate-400 mt-0.5">100 pts = $1.00 credit</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Stamp Card Goal</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">6 Stamps</p>
          <p className="text-[11px] text-indigo-600 font-medium mt-0.5">Free Pastry or Drink</p>
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

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-900">Complimentary Cloudberry Mocktail</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  250 pts
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Available across all dine-in QR orders</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-900">15% Off Total Dining Bill</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  500 pts
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Applies instantly at QR table checkout</p>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-900">Free Chef Special Tasting Plate</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  800 pts
                </span>
              </div>
              <p className="text-[11px] text-slate-500">VIP culinary experience reward</p>
            </div>
          </div>
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
                onChange={e => setSearchMember(e.target.value)}
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
                  <th className="py-2.5 px-3">Lifetime Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <div>
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        <p className="text-[11px] text-slate-400">{m.email} • {m.phone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {m.tier}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {m.points} pts
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-700">{m.stamps}/6 stamps</span>
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
