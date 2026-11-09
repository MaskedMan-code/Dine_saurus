import React, { useState } from 'react';
import { useRestaurant, AppViewMode } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseConnection } from '../../lib/useSupabaseConnection';
import {
  Smartphone,
  LayoutGrid,
  ChefHat,
  Table as TableIcon,
  BookOpen,
  Bell,
  BarChart3,
  Award,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Database,
  MapPin,
  Users,
  LogOut,
  UserCircle2,
  ChevronDown,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    restaurant,
    activeLocationId,
    setActiveLocationId,
    serviceRequests,
    orders,
    soundEnabled,
    setSoundEnabled,
  } = useRestaurant();
  const { user, customer, staff, isAdmin, signOut } = useAuth();
  const { connected: isSupabaseConnected } = useSupabaseConnection();
  const [menuOpen, setMenuOpen] = useState(false);

  const openServiceRequestsCount = serviceRequests.filter((r) => r.status === 'open').length;
  const pendingOrdersCount = orders.filter(
    (o) => o.status === 'pending' || o.status === 'preparing',
  ).length;

  const navItems: {
    id: AppViewMode;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    color?: string;
  }[] = [
    { id: 'customer', label: 'Customer Menu (QR)', icon: <Smartphone className="w-4 h-4" /> },
    {
      id: 'kds',
      label: 'Kitchen (KDS)',
      icon: <ChefHat className="w-4 h-4" />,
      badge: pendingOrdersCount,
    },
    { id: 'pos', label: 'POS & Cashier', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'tables', label: 'Floor Plan & QR', icon: <TableIcon className="w-4 h-4" /> },
    { id: 'menu', label: 'Menu Catalog', icon: <BookOpen className="w-4 h-4" /> },
    {
      id: 'service_desk',
      label: 'Service Desk',
      icon: <Bell className="w-4 h-4" />,
      badge: openServiceRequestsCount,
      color: openServiceRequestsCount > 0 ? 'bg-[#8d4e2d]' : undefined,
    },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'loyalty_admin', label: 'Loyalty & CRM', icon: <Award className="w-4 h-4" /> },
    { id: 'settings', label: 'SaaS & Branch', icon: <SettingsIcon className="w-4 h-4" /> },
    ...(isAdmin
      ? [{ id: 'admin_users' as AppViewMode, label: 'Users', icon: <Users className="w-4 h-4" /> }]
      : []),
  ];

  const displayName =
    customer?.name || (staff ? `${staff.role[0].toUpperCase()}${staff.role.slice(1)}` : null);

  return (
    <header className="sticky top-0 z-50 bg-[#16342b] text-white border-b border-[#2d4b41] shadow-sm select-none no-print">
      {/* Top Brand & Tenant Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Restaurant Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2d4b41] border border-[#3e6357] flex items-center justify-center text-[#c8eadc] shadow-sm font-bold text-base">
            <span className="material-symbols-outlined text-[20px]">restaurant</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-[15px] text-white">
                {restaurant?.name || 'Setting up…'}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2d4b41] text-[#c8eadc] border border-[#46655a]">
                Nordic OS
              </span>
            </div>
            <p className="text-[11px] text-[#adcec0] hidden sm:block">
              Multi-tenant Restaurant SaaS & QR Platform
            </p>
          </div>
        </div>

        {/* Location & Controls Cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Branch Switcher */}
          {restaurant && (
            <div className="flex items-center gap-1.5 bg-[#244238] px-2.5 py-1.5 rounded-xl border border-[#3a5d51] text-xs">
              <MapPin className="w-3.5 h-3.5 text-[#adcec0]" />
              <select
                value={activeLocationId}
                onChange={(e) => setActiveLocationId(e.target.value)}
                className="bg-transparent text-[#f9f9f7] text-xs font-medium focus:outline-none cursor-pointer"
              >
                {restaurant.locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-[#16342b] text-white">
                    {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Supabase Status Pill */}
          <div
            title="Connected to Supabase PostgreSQL & Realtime"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#244238] border border-[#3a5d51] text-xs text-[#c8eadc]"
          >
            <Database className="w-3.5 h-3.5 text-[#c8eadc]" />
            <span className="text-[11px] font-medium text-[#adcec0]">Supabase Live</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Live Order Audio Alerts ON' : 'Audio Alerts Muted'}
            className="p-1.5 rounded-xl hover:bg-[#2d4b41] text-[#adcec0] hover:text-white transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#c8eadc]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#727975]" />
            )}
          </button>

          {/* Account Menu */}
          {user ? (
            <div className="relative">
              <button
                aria-label="Account menu"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 bg-[#244238] hover:bg-[#2d4b41] px-2.5 py-1.5 rounded-xl border border-[#3a5d51] text-xs text-white transition-colors cursor-pointer"
              >
                <UserCircle2 className="w-4 h-4 text-[#c8eadc]" />
                <span className="hidden sm:inline max-w-[90px] truncate">
                  {displayName || user.email}
                </span>
                <ChevronDown className="w-3 h-3 text-[#adcec0]" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-[#e5e3dd] shadow-lg py-1.5 z-50">
                  <div className="px-3 py-2 border-b border-[#f0efe9]">
                    <p className="text-xs font-medium text-[#242424] truncate">{user.email}</p>
                    <p className="text-[10px] text-[#9a9a9a]">
                      {customer ? 'Customer account' : `Staff · ${staff?.role}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8d4e2d] hover:bg-[#f9f9f7] cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span className="hidden sm:inline text-[11px] text-[#adcec0] px-2">Not signed in</span>
          )}
        </div>
      </div>

      {/* Primary Navigation / View Tabs */}
      <div className="bg-[#0f241e] border-t border-[#23453a] overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 py-1.5">
          {navItems.map((item) => {
            const isActive = viewMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setViewMode(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#16342b] text-white shadow-sm font-semibold border border-[#3e6357]'
                    : 'text-[#adcec0] hover:text-white hover:bg-[#16342b]/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                      item.color || 'bg-[#8d4e2d]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
