import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resolveMembership, type MembershipRow, type StaffRow } from '../lib/authMembership';
import { readStorage } from '../lib/storage';
import { diagnostic } from '../lib/diagnostics';

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
  authLoading: boolean;
  profileLoading: boolean;
  authError: string | null;
  profileError: string | null;
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  customer: CustomerRecord | null;
  staff: StaffRecord | null;
  isCustomer: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retrySession: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
type ProfileData = {
  userId: string;
  profile: AppProfile;
  staff: StaffRecord | null;
  customer: CustomerRecord | null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [profileTick, setProfileTick] = useState(0);
  const [sessionTick, setSessionTick] = useState(0);
  const version = useRef(0);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    let alive = true;
    let eventVersion = 0;
    let observedEvent = false;
    setAuthLoading(true);
    // Synchronous callback: database work belongs to the user-ID effect below.
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      if (event === 'INITIAL_SESSION' && observedEvent) return;
      if (event !== 'INITIAL_SESSION') observedEvent = true;
      eventVersion++;
      diagnostic('auth-event', { event });
      setSession(next);
      setAuthError(null);
      setAuthLoading(false);
      if (event === 'SIGNED_OUT') {
        version.current++;
        setData(null);
        setProfileError(null);
      }
      if (event === 'USER_UPDATED') setProfileTick((t) => t + 1);
    });
    const initialVersion = eventVersion;
    void supabase.auth
      .getSession()
      .then(({ data: initial, error }) => {
        if (!alive || eventVersion !== initialVersion) return;
        if (error) setAuthError(error.message);
        else setSession(initial.session);
        setAuthLoading(false);
      })
      .catch((error: unknown) => {
        if (alive && eventVersion === initialVersion) {
          setAuthError(error instanceof Error ? error.message : 'Could not restore your session.');
          setAuthLoading(false);
        }
      });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [sessionTick]);

  useEffect(() => {
    const requestVersion = ++version.current;
    const controller = new AbortController();
    setProfileError(null);
    if (!userId) {
      setData(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    void (async () => {
      try {
        const [profileResult, membershipsResult, staffResult, customerResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, phone')
            .eq('id', userId)
            .abortSignal(controller.signal)
            .single(),
          supabase
            .from('organization_members')
            .select('id, organization_id, user_id, role, is_active')
            .eq('user_id', userId)
            .abortSignal(controller.signal),
          supabase
            .from('staff_members')
            .select('id, organization_id, user_id, status')
            .eq('user_id', userId)
            .abortSignal(controller.signal),
          supabase
            .from('customers')
            .select('*')
            .eq('auth_user_id', userId)
            .order('organization_id')
            .abortSignal(controller.signal),
        ]);
        const error =
          profileResult.error ||
          membershipsResult.error ||
          staffResult.error ||
          customerResult.error;
        if (error) throw new Error(error.message);
        if (!profileResult.data)
          throw new Error(
            'Your session is active, but your profile is missing. Contact your administrator.',
          );
        const staff = resolveMembership(
          membershipsResult.data as MembershipRow[],
          staffResult.data as StaffRow[],
          readStorage(`dinesaurus:organization:${userId}`),
        );
        const row =
          customerResult.data?.find((r) => r.organization_id === staff?.organizationId) ??
          customerResult.data?.[0];
        if (controller.signal.aborted || version.current !== requestVersion) return;
        setData({
          userId,
          profile: {
            id: profileResult.data.id,
            displayName: profileResult.data.display_name,
            phone: profileResult.data.phone,
          },
          staff,
          customer: row
            ? {
                id: row.id,
                organizationId: row.organization_id,
                authUserId: row.auth_user_id,
                name: row.name,
                phone: row.phone,
                phoneVerified: row.phone_verified,
                pointsBalance: row.points_balance,
                stampsCount: row.stamps_count,
                stampsRequired: row.stamps_required,
                tier: row.tier,
              }
            : null,
        });
      } catch (error) {
        if (!controller.signal.aborted && version.current === requestVersion) {
          setData(null); // Fail closed on authorization errors, without discarding authentication.
          setProfileError(error instanceof Error ? error.message : 'Could not load your profile.');
        }
      } finally {
        if (!controller.signal.aborted && version.current === requestVersion)
          setProfileLoading(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [userId, profileTick]);

  const refreshProfile = useCallback(async () => {
    setProfileTick((t) => t + 1);
  }, []);
  const retrySession = useCallback(() => setSessionTick((t) => t + 1), []);
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error?.message ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to sign in. Please retry.' };
    }
  };
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        return;
      }
      version.current++;
      setSession(null);
      setData(null);
      setProfileError(null);
      // Remove only this app's session data, preserving unrelated applications on the origin.
      try {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('dinesaurus:'))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        /* Storage can be disabled. */
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign out failed. Please retry.');
    }
  };
  const current = data?.userId === userId ? data : null;
  const staff = current?.staff ?? null;
  const customer = current?.customer ?? null;
  const resolvingProfile = !!userId && (profileLoading || (!current && !profileError));
  return (
    <AuthContext.Provider
      value={{
        loading: authLoading || resolvingProfile,
        authLoading,
        profileLoading: resolvingProfile,
        authError,
        profileError,
        session,
        user: session?.user ?? null,
        profile: current?.profile ?? null,
        customer,
        staff,
        isCustomer: !!customer,
        isStaff: !!staff?.isActive,
        isAdmin: !!staff?.isActive && ['owner', 'admin'].includes(staff.role),
        signIn,
        signOut,
        refreshProfile,
        retrySession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
