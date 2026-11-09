import React, { useState } from 'react';
import { useAuth, StaffRole } from '../../context/AuthContext';
import { resolveOrgByCode } from '../../lib/tenant';
import { ShieldCheck, Mail, Lock, User, Loader2, ChevronDown, Building2, Users2 } from 'lucide-react';

const ROLE_OPTIONS: { value: StaffRole; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Manage staff, menu, settings' },
  { value: 'manager', label: 'Manager', hint: 'Run POS, KDS, tables, service desk' },
  { value: 'staff', label: 'Staff', hint: 'POS, KDS, service desk only' },
];

export const StaffAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, isStaff, staff, signIn, signUpStaff } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupPath, setSignupPath] = useState<'new' | 'join'>('new');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('staff');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#16342b]" />
      </div>
    );
  }

  if (isStaff && staff?.isActive) return <>{children}</>;

  if (isStaff && !staff?.isActive) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-sm text-center bg-white rounded-2xl border border-[#e5e3dd] p-6">
          <ShieldCheck className="w-8 h-8 text-[#8d4e2d] mx-auto mb-3" />
          <h2 className="font-semibold text-[#242424] mb-1">Waiting for approval</h2>
          <p className="text-sm text-[#6b6b6b]">
            Your staff account was created. An owner or admin needs to activate your access from the Users panel before you can use staff tools.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        setSubmitting(false);
        return;
      }

      if (signupPath === 'new') {
        if (!orgName.trim()) {
          setError('Please name your restaurant or business.');
          setSubmitting(false);
          return;
        }
        const { error: err } = await signUpStaff(email, password, fullName, { newOrganizationName: orgName });
        if (err) setError(err);
        else setInfo('Account created! You are the owner. Check your inbox to confirm your email, then sign in and set up your restaurant.');
      } else {
        if (!joinCode.trim()) {
          setError('Enter the team join code your owner/admin shared with you.');
          setSubmitting(false);
          return;
        }
        const resolved = await resolveOrgByCode(joinCode);
        if (!resolved) {
          setError('That join code was not recognized. Double-check it with your admin.');
          setSubmitting(false);
          return;
        }
        const { error: err } = await signUpStaff(email, password, fullName, {
          joinOrganizationId: resolved.organizationId,
          staffRole,
        });
        if (err) setError(err);
        else setInfo(`Account created for ${resolved.organizationName}! Confirm your email, then sign in — an admin must approve your access.`);
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 bg-[#0f241e]">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e5e3dd] shadow-sm p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#16342b] flex items-center justify-center text-[#c8eadc] mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-[#242424]">
            {mode === 'signup' ? 'Register staff account' : 'Staff sign in'}
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            {mode === 'signup' ? 'Set up access to POS, kitchen, and admin tools.' : 'Access the restaurant management console.'}
          </p>
        </div>

        {mode === 'signup' && (
          <div className="flex gap-2 mb-4 bg-[#f4f3ee] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setSignupPath('new')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors ${signupPath === 'new' ? 'bg-white shadow-sm text-[#16342b]' : 'text-[#8a8a8a]'}`}
            >
              <Building2 className="w-3.5 h-3.5" /> New restaurant
            </button>
            <button
              type="button"
              onClick={() => setSignupPath('join')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors ${signupPath === 'join' ? 'bg-white shadow-sm text-[#16342b]' : 'text-[#8a8a8a]'}`}
            >
              <Users2 className="w-3.5 h-3.5" /> Join a team
            </button>
          </div>
        )}

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

          {mode === 'signup' && signupPath === 'new' && (
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
              <input
                type="text"
                required
                placeholder="Restaurant or business name"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20"
              />
            </div>
          )}

          {mode === 'signup' && signupPath === 'join' && (
            <>
              <div className="relative">
                <Users2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
                <input
                  type="text"
                  required
                  placeholder="Team join code (e.g. F151E3)"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20 uppercase"
                />
              </div>
              <div className="relative">
                <select
                  value={staffRole}
                  onChange={e => setStaffRole(e.target.value as StaffRole)}
                  className="w-full appearance-none pl-3 pr-9 py-2.5 rounded-xl border border-[#e5e3dd] text-sm focus:outline-none focus:ring-2 focus:ring-[#16342b]/20 bg-white"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.hint}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9a9a] pointer-events-none" />
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="email"
              required
              placeholder="Work email"
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
            {mode === 'signup' ? 'Create staff account' : 'Sign in'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null); }}
          className="w-full text-center text-xs text-[#6b6b6b] mt-4 hover:text-[#16342b]"
        >
          {mode === 'signup' ? 'Already have staff access? Sign in' : 'New team member? Register here'}
        </button>
      </div>
    </div>
  );
};
