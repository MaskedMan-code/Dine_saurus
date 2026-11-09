import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { RestaurantProvider, useRestaurant } from './context/RestaurantContext';
import { Navbar } from './components/layout/Navbar';
import { CustomerView } from './components/customer/CustomerView';
import { KitchenView } from './components/kds/KitchenView';
import { POSView } from './components/pos/POSView';
import { TablesFloorView } from './components/tables/TablesFloorView';
import { MenuAdminView } from './components/menu/MenuAdminView';
import { ServiceDeskView } from './components/service/ServiceDeskView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { LoyaltyAdminView } from './components/loyalty/LoyaltyAdminView';
import { SettingsView } from './components/settings/SettingsView';
import { AdminUsersView } from './components/admin/AdminUsersView';
import { CustomerAuthGate } from './components/auth/CustomerAuthGate';
import { StaffAuthGate } from './components/auth/StaffAuthGate';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { supabaseConfigError } from './lib/supabase';
import { Loader2, AlertTriangle, ServerCrash } from 'lucide-react';

const ConfigErrorScreen: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#0f241e] px-4">
    <div className="max-w-md bg-white rounded-2xl p-6 text-center">
      <ServerCrash className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <h1 className="font-semibold text-[#242424] mb-2">Supabase isn't configured</h1>
      <p className="text-sm text-[#6b6b6b]">{message}</p>
    </div>
  </div>
);

const StaffShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { staff } = useAuth();
  const { needsOnboarding, loading, error, retry } = useTenant();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#16342b]" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-[#6b6b6b] max-w-sm">Couldn't load your organization's data: {error}</p>
        <button onClick={retry} className="text-sm font-medium text-[#16342b] underline">Retry</button>
      </div>
    );
  }
  if (needsOnboarding && staff) {
    return <OnboardingWizard />;
  }
  return <>{children}</>;
};

const MainContent: React.FC = () => {
  const { viewMode, restaurant, dataLoading, dataError, retryLoad } = useRestaurant();
  const { needsOnboarding } = useTenant();

  const renderActiveView = () => {
    switch (viewMode) {
      case 'customer':
        return <CustomerAuthGate><CustomerView /></CustomerAuthGate>;
      case 'kds':
        return <StaffAuthGate><StaffShell><KitchenView /></StaffShell></StaffAuthGate>;
      case 'pos':
        return <StaffAuthGate><StaffShell><POSView /></StaffShell></StaffAuthGate>;
      case 'tables':
        return <StaffAuthGate><StaffShell><TablesFloorView /></StaffShell></StaffAuthGate>;
      case 'menu':
        return <StaffAuthGate><StaffShell><MenuAdminView /></StaffShell></StaffAuthGate>;
      case 'service_desk':
        return <StaffAuthGate><StaffShell><ServiceDeskView /></StaffShell></StaffAuthGate>;
      case 'analytics':
        return <StaffAuthGate><StaffShell><AnalyticsView /></StaffShell></StaffAuthGate>;
      case 'loyalty_admin':
        return <StaffAuthGate><StaffShell><LoyaltyAdminView /></StaffShell></StaffAuthGate>;
      case 'settings':
        return <StaffAuthGate><StaffShell><SettingsView /></StaffShell></StaffAuthGate>;
      case 'admin_users':
        return <StaffAuthGate><StaffShell><AdminUsersView /></StaffShell></StaffAuthGate>;
      default:
        return <CustomerAuthGate><CustomerView /></CustomerAuthGate>;
    }
  };

  // Staff mid-onboarding: let StaffShell render the wizard full-screen without the "loading restaurant" gate below
  // (there is no restaurant yet by definition, so don't block on dataLoading/restaurant-null in that case).
  const isStaffView = viewMode !== 'customer';

  if (!isStaffView || !needsOnboarding) {
    if (dataError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center bg-[#f9f9f7]">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-[#6b6b6b] max-w-sm">{dataError}</p>
          <button onClick={retryLoad} className="text-sm font-medium text-[#16342b] underline">Retry</button>
        </div>
      );
    }
    if (dataLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f9f9f7]">
          <div className="flex flex-col items-center gap-3 text-[#16342b]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm text-[#6b6b6b]">Loading your restaurant…</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f9f7] text-[#242424] flex flex-col selection:bg-[#c8eadc] selection:text-[#012018]">
      <Navbar />
      <main className="flex-1 w-full">{renderActiveView()}</main>
    </div>
  );
};

export default function App() {
  if (supabaseConfigError) {
    return <ConfigErrorScreen message={supabaseConfigError} />;
  }
  return (
    <AuthProvider>
      <TenantProvider>
        <RestaurantProvider>
          <MainContent />
        </RestaurantProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
