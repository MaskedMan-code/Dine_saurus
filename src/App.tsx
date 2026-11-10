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
import { OperatorGate } from './components/auth/OperatorGate';
import { PlatformAdminView } from './components/admin/PlatformAdminView';
import { useRouteView } from './lib/route';
import { NetworkStatus } from './components/layout/NetworkStatus';

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

  if (loading && !needsOnboarding) {
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
        <p className="text-sm text-[#6b6b6b] max-w-sm">
          Couldn't load your organization's data: {error}
        </p>
        <button onClick={retry} className="text-sm font-medium text-[#16342b] underline">
          Retry
        </button>
      </div>
    );
  }
  if (needsOnboarding && staff) {
    if (!['owner', 'admin'].includes(staff.role))
      return (
        <p className="p-8 text-center text-sm text-[#70706b]">
          Ask your restaurant owner to finish restaurant setup before using staff tools.
        </p>
      );
    return <OnboardingWizard />;
  }
  return <>{children}</>;
};

const MainContent: React.FC = () => {
  const {
    viewMode,
    restaurant,
    dataLoading,
    dataError,
    dataRefreshing,
    mutationError,
    dismissMutationError,
    retryLoad,
  } = useRestaurant();
  const { needsOnboarding } = useTenant();

  const renderActiveView = () => {
    switch (viewMode) {
      case 'customer':
        return (
          <CustomerAuthGate>
            <CustomerView />
          </CustomerAuthGate>
        );
      case 'kds':
        return (
          <StaffShell>
            <KitchenView />
          </StaffShell>
        );
      case 'pos':
        return (
          <StaffShell>
            <POSView />
          </StaffShell>
        );
      case 'tables':
        return (
          <StaffShell>
            <TablesFloorView />
          </StaffShell>
        );
      case 'menu':
        return (
          <StaffShell>
            <MenuAdminView />
          </StaffShell>
        );
      case 'service_desk':
        return (
          <StaffShell>
            <ServiceDeskView />
          </StaffShell>
        );
      case 'analytics':
        return (
          <StaffShell>
            <AnalyticsView />
          </StaffShell>
        );
      case 'loyalty_admin':
        return (
          <StaffShell>
            <LoyaltyAdminView />
          </StaffShell>
        );
      case 'settings':
        return (
          <StaffShell>
            <SettingsView />
          </StaffShell>
        );
      case 'admin_users':
        return (
          <StaffShell>
            <AdminUsersView />
          </StaffShell>
        );
      default:
        return (
          <CustomerAuthGate>
            <CustomerView />
          </CustomerAuthGate>
        );
    }
  };

  // Staff mid-onboarding: let StaffShell render the wizard full-screen without the "loading restaurant" gate below
  // (there is no restaurant yet by definition, so don't block on dataLoading/restaurant-null in that case).
  const isStaffView = viewMode !== 'customer';

  if (!isStaffView || !needsOnboarding) {
    if (dataError && !restaurant) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center bg-[#f9f9f7]">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-[#6b6b6b] max-w-sm">{dataError}</p>
          <button onClick={retryLoad} className="text-sm font-medium text-[#16342b] underline">
            Retry
          </button>
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
      {viewMode !== 'customer' && <Navbar />}
      {dataRefreshing && (
        <p role="status" className="px-4 py-1 text-xs text-[#70706b]">
          Refreshing restaurant data?
        </p>
      )}
      {(mutationError || (dataError && restaurant)) && (
        <div
          role="alert"
          className="px-4 py-3 bg-red-50 text-red-800 text-sm flex items-center justify-between gap-3"
        >
          <span>{mutationError || dataError}</span>
          <button
            onClick={mutationError ? dismissMutationError : retryLoad}
            className="underline p-2"
          >
            {mutationError ? 'Dismiss' : 'Retry'}
          </button>
        </div>
      )}
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
      <NetworkStatus />
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { viewMode } = useRouteView();
  if (viewMode === 'platform_admin')
    return (
      <StaffAuthGate platform>
        <OperatorGate platform>
          <PlatformAdminView />
        </OperatorGate>
      </StaffAuthGate>
    );
  const content = (
    <TenantProvider>
      <RestaurantProvider>
        <MainContent />
      </RestaurantProvider>
    </TenantProvider>
  );
  return viewMode === 'customer' ? (
    content
  ) : (
    <StaffAuthGate>
      <OperatorGate>{content}</OperatorGate>
    </StaffAuthGate>
  );
}
