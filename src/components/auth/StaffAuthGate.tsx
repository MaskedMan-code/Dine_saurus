import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';

export const StaffAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    authLoading,
    profileLoading,
    user,
    staff,
    isStaff,
    authError,
    profileError,
    signIn,
    signOut,
    refreshProfile,
    retrySession,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  if (authLoading || (user && profileLoading && !staff))
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#16342b]" />
      </div>
    );
  if (user && (profileError || !isStaff))
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-4">
        <h1 className="text-xl font-semibold text-[#16342b]">Your session is active</h1>
        <p role="alert">
          {profileError ||
            (staff
              ? 'Your staff access is pending approval or inactive. Contact your restaurant administrator.'
              : 'No authorized restaurant membership was found. Contact your administrator.')}
        </p>
        <button className="underline p-2" onClick={() => void refreshProfile()}>
          Retry access
        </button>
        <button className="underline p-2" onClick={() => void signOut()}>
          Sign out
        </button>
        {authError && <p role="alert">{authError}</p>}
      </div>
    );
  if (isStaff) return <>{children}</>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn(email, password);
      if (result.error) setError(result.error);
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e3dd] bg-white p-6 shadow-sm">
        <ShieldCheck className="w-9 h-9 text-[#16342b] mb-3" />
        <h1 className="text-xl font-bold text-[#16342b]">Restaurant team sign in</h1>
        <p className="text-sm text-[#70706b] my-3">
          Use the email and password provided by your administrator.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            Email
            <input
              className="block w-full border rounded-xl p-3 mt-1"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              className="block w-full border rounded-xl p-3 mt-1"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {(error || authError) && (
            <p role="alert" className="text-sm text-red-700">
              {error || authError}
            </p>
          )}
          {authError && (
            <button type="button" onClick={retrySession} className="underline">
              Retry session restoration
            </button>
          )}
          <button
            disabled={submitting}
            className="w-full bg-[#16342b] text-white rounded-xl p-3 disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-[#70706b] mt-4">
          Need an account or password reset? Contact your restaurant administrator.
        </p>
      </div>
    </div>
  );
};
