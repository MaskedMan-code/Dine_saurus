import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type StaffRole = 'owner' | 'admin' | 'manager' | 'staff';

export interface AppProfile {
  id: string;
  displayName: string | null;
  phone: string | null;
}

export interface CustomerRecord {
  id: string;
  organizationId: string;
  authUserId: string;
  name: string;
  phone: string | null;
  phoneVerified: boolean;
  pointsBalance: number;
  stampsCount: number;
  stampsRequired: number;
  tier: string;
}

export interface StaffRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: StaffRole;
  isActive: boolean;
  status: string;
}

interface AuthContextType {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  customer: CustomerRecord | null;
  staff: StaffRecord | null;
  isCustomer: boolean;
  isStaff: boolean;
  isAdmin: boolean; // owner or admin
  signUpCustomer: (email: string, password: string, fullName: string, phone: string, organizationId: string) => Promise<{ error: string | null }>;
  signUpStaff: (
    email: string,
    password: string,
    fullName: string,
    opts: { newOrganizationName?: string; joinOrganizationId?: string; staffRole?: StaffRole }
  ) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [staff, setStaff] = useState<StaffRecord | null>(null);

  const loadProfileData = useCallback(async (userId: string) => {
    const [{ data: profileRow }, { data: customerRow }, { data: staffRow }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('customers').select('*').eq('auth_user_id', userId).maybeSingle(),
      supabase.from('organization_members').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    setProfile(
      profileRow
        ? { id: profileRow.id, displayName: profileRow.display_name, phone: profileRow.phone }
        : null
    );

    setCustomer(
      customerRow
        ? {
            id: customerRow.id,
            organizationId: customerRow.organization_id,
            authUserId: customerRow.auth_user_id,
            name: customerRow.name,
            phone: customerRow.phone,
            phoneVerified: customerRow.phone_verified,
            pointsBalance: customerRow.points_balance,
            stampsCount: customerRow.stamps_count,
            stampsRequired: customerRow.stamps_required,
            tier: customerRow.tier,
          }
        : null
    );

    setStaff(
      staffRow
        ? {
            id: staffRow.id,
            organizationId: staffRow.organization_id,
            userId: staffRow.user_id,
            role: staffRow.role,
            isActive: staffRow.is_active,
            status: staffRow.is_active ? 'active' : 'pending',
          }
        : null
    );
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfileData(session.user.id);
    }
  }, [session, loadProfileData]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfileData(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfileData(newSession.user.id);
      } else {
        setProfile(null);
        setCustomer(null);
        setStaff(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfileData]);

  const signUpCustomer = async (email: string, password: string, fullName: string, phone: string, organizationId: string) => {
    if (!organizationId) {
      return { error: 'No restaurant context found. Please scan the table QR code again or open a valid restaurant link.' };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'customer', full_name: fullName, phone, organization_id: organizationId },
      },
    });
    return { error: error ? error.message : null };
  };

  const signUpStaff = async (
    email: string,
    password: string,
    fullName: string,
    opts: { newOrganizationName?: string; joinOrganizationId?: string; staffRole?: StaffRole }
  ) => {
    const metadata: Record<string, string> = { role: 'staff', full_name: fullName };
    if (opts.joinOrganizationId) {
      metadata.organization_id = opts.joinOrganizationId;
      if (opts.staffRole) metadata.staff_role = opts.staffRole;
    } else if (opts.newOrganizationName) {
      metadata.organization_name = opts.newOrganizationName;
      // no organization_id => trigger creates a brand-new organization and this user becomes its owner
    } else {
      return { error: 'Provide either a new restaurant/business name or a team join code.' };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { error: error ? error.message : null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        profile,
        customer,
        staff,
        isCustomer: !!customer,
        isStaff: !!staff,
        isAdmin: staff?.role === 'owner' || staff?.role === 'admin',
        signUpCustomer,
        signUpStaff,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
