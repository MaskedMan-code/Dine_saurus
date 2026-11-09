import React from 'react';
import { useTenant } from '../../context/TenantContext';
import { Loader2 } from 'lucide-react';
export const CustomerAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, error, activeRestaurantId, retry } = useTenant();
  if (loading)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#16342b]" />
      </div>
    );
  if (error)
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-4">
        <p role="alert">{error}</p>
        <button onClick={retry} className="underline p-3">
          Retry restaurant link
        </button>
      </div>
    );
  if (!activeRestaurantId)
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="font-bold text-[#16342b]">Welcome to Dine_saurus</h1>
        <p className="mt-3">
          Scan your table QR to open the menu. You can order with your name and mobile number.
        </p>
      </div>
    );
  return <>{children}</>;
};
