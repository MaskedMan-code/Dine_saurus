import React, { useState, useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseConnection } from '../../lib/useSupabaseConnection';
import { supabase } from '../../lib/supabase';
import {
  Settings as SettingsIcon,
  Building,
  CreditCard,
  Database,
  Sliders,
  CheckCircle2,
  Sparkles,
  Layers,
  MapPin,
  Percent,
  DollarSign,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { SAAS_PLANS } from '../../data/seedData';
import { SaaSPlan } from '../../types';

export const SettingsView: React.FC = () => {
  const {
    restaurant,
    activeLocationId,
  } = useRestaurant();
  const { staff } = useAuth();
  const connection = useSupabaseConnection();

  const [activeTab, setActiveTab] = useState<'branch' | 'billing' | 'supabase' | 'taxes'>('branch');
  const [saveToast, setSaveToast] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const { currentPlan: saasPlan, setCurrentPlan: setSaasPlan } = useRestaurant();

  useEffect(() => {
    if (!staff) return;
    supabase.from('organizations').select('join_code').eq('id', staff.organizationId).maybeSingle()
      .then(({ data }) => setJoinCode(data?.join_code || null));
  }, [staff]);

  if (!restaurant) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center text-sm text-slate-500">
        No restaurant loaded yet.
      </div>
    );
  }

  const activeLoc = restaurant.locations.find(l => l.id === activeLocationId) || restaurant.locations[0];

  const handleSave = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(''), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900">SaaS & Branch Settings</h2>
            <p className="text-xs text-slate-500">Configure multi-branch locations, SaaS subscription plan, tax policies, and database</p>
          </div>
        </div>

        {saveToast && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveToast}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-fit text-xs font-medium">
        <button
          onClick={() => setActiveTab('branch')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
            activeTab === 'branch'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Branch & Identity</span>
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
            activeTab === 'billing'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>SaaS Subscription Plans</span>
        </button>

        <button
          onClick={() => setActiveTab('taxes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
            activeTab === 'taxes'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Taxes & Charges</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
            activeTab === 'supabase'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Supabase Infrastructure</span>
        </button>
      </div>

      {/* Content Panes */}
      {activeTab === 'branch' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-semibold text-base text-slate-900">Branch Configuration ({activeLoc.name})</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Restaurant Brand Name</label>
              <input
                type="text"
                defaultValue={restaurant.name}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Tagline & Cuisine</label>
              <input
                type="text"
                defaultValue={`${restaurant.cuisineType} — ${restaurant.tagline}`}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Branch Physical Address</label>
              <input
                type="text"
                defaultValue={activeLoc.address}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                defaultValue={activeLoc.phone}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Currency Code & Symbol</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  defaultValue={restaurant.currencySymbol}
                  className="w-20 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-bold"
                />
                <input
                  type="text"
                  defaultValue={restaurant.currencyCode}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Operating Hours</label>
              <input
                type="text"
                defaultValue={activeLoc.openingHours}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => handleSave('Branch details saved successfully!')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm transition cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-base text-slate-900">Multi-tenant SaaS Subscription Tiers</h3>
            <p className="text-xs text-slate-500">Select an active subscription tier to unlock multi-location, kitchen display, and loyalty perks.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SAAS_PLANS.map(plan => {
              const isCurrent = saasPlan.id === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl p-5 border transition-all flex flex-col justify-between ${
                    isCurrent
                      ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-base text-slate-900">{plan.name}</h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline">
                      <span className="text-3xl font-extrabold text-slate-900">${plan.priceMonthly}</span>
                      <span className="text-xs text-slate-500 ml-1">/ month</span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Max Locations:</span>
                        <strong className="text-slate-900">{plan.maxLocations}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Max Tables:</span>
                        <strong className="text-slate-900">{plan.maxTables}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Monthly Orders:</span>
                        <strong className="text-slate-900">{plan.orderLimitMonthly}</strong>
                      </div>

                      <div className="pt-2 space-y-1">
                        {plan.features.map((feat, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSaasPlan(plan);
                      handleSave(`Switched plan to ${plan.name}`);
                    }}
                    className={`mt-5 w-full py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                    }`}
                  >
                    {isCurrent ? 'Current Tier' : 'Upgrade to Plan'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'taxes' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-semibold text-base text-slate-900">Tax Rates & Automatic Service Charges</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">State / VAT Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                defaultValue={restaurant.taxRatePercent}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Calculated automatically on subtotal during table checkout.</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Staff Dine-in Service Charge (%)</label>
              <input
                type="number"
                step="0.1"
                defaultValue={restaurant.serviceChargePercent}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Applied for seated dine-in QR orders only.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => handleSave('Tax and charge rates updated!')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm transition cursor-pointer"
            >
              Update Rates
            </button>
          </div>
        </div>
      )}

      {activeTab === 'supabase' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-500" />
              <span>Supabase PostgreSQL & Realtime Status</span>
            </h3>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${connection.connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              <span className={`w-2 h-2 rounded-full ${connection.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span>{connection.connected ? 'Connected & Operational' : 'Connection Issue'}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Supabase Realtime Channel:</span>
                <code className="text-indigo-600 font-mono">public:orders, public:service_requests</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Connection Status:</span>
                <span className={`font-medium ${connection.connected ? 'text-emerald-700' : 'text-red-600'}`}>{connection.message}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Organization ID:</span>
                <code className="text-slate-700 font-mono">{staff?.organizationId || '—'}</code>
              </div>
            </div>
            {joinCode && (
              <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-indigo-900">Team join code</p>
                  <p className="text-indigo-700">Share this with teammates so they can join your organization at signup.</p>
                </div>
                <code className="text-lg font-bold tracking-widest bg-white px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-900">{joinCode}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
