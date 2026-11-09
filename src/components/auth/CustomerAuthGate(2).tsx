import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { UtensilsCrossed, Mail, Lock, User, Phone, Loader2, AlertTriangle } from 'lucide-react';

export const CustomerAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, isCustomer, signIn, signUpCustomer } = useAuth();
  const { loading: tenantLoading, error: tenantError, organizationId, source, retry } = useTenant();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading || tenantLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#16342b]" />
      </div>
    );
  }

  if (tenantError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-[#6b6b6b] max-w-sm">Couldn't load the restaurant: {tenantError}</p>
        <button onClick={retry} className="text-sm font-medium text-[#16342b] underline">Retry</button>
      </div>
    );
  }

  if (isCustomer) return <>{children}</>;

  // QR/restaurant public pages can browse and order as a guest. Account creation remains optional.
  if (organizationId && (source === 'qr-token' || source === 'restaurant-slug')) return <>{children}</>;

  if (!organizationId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center gap-3">
        <UtensilsCrossed className="w-8 h-8 text-[#9a9a9a]" />
        <p className="text-sm text-[#6b6b6b] max-w-sm">
          No restaurant is linked to this page yet. Scan a table's QR code, or open a link with
          <code className="mx-1 px-1.5 py-0.5 bg-[#f0efe9] rounded text-xs">?restaurant=your-slug</code>
          to browse and register.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    if (mode === 'signup') {
      if (!fullName.trim() || !phone.trim()) {
        setError('Please enter your name and phone number.');
        setSubmitting(false);
        return;
      }
      const { error: err } = await signUpCustomer(email, password, fullName, phone, organizationId!);
      if (err) setError(err);
      else setInfo('Account created! Check your inbox to confirm your email, then sign in.');
    } else {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 bg-[#f9f9f7]">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e5e3dd] shadow-sm p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#16342b] flex items-center justify-center text-[#c8eadc] mb-3">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-[#242424]">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            {mode === 'signup' ? 'Sign up to order, earn rewards, and track your table.' : 'Sign in to continue ordering.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
              <input
                type="text"
                required
                placeholder="Full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20"
              />
            </div>
          )}
          {mode === 'signup' && (
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
              <input
                type="tel"
                required
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20"
            />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {info && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-[#16342b] text-white text-sm font-semibold hover:bg-[#1e4438] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null); }}
          className="w-full text-center text-xs text-[#6b6b6b] mt-4 hover:text-[#16342b]"
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
};
