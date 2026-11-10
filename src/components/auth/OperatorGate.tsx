import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pilotAdmin, pilotRpc } from '../../lib/pilot';

export function OperatorGate({
  children,
  platform = false,
}: {
  children: React.ReactNode;
  platform?: boolean;
}) {
  const { user, signOut } = useAuth();
  const [gate, setGate] = useState<any>(null),
    [error, setError] = useState(''),
    [tick, setTick] = useState(0);
  const [password, setPassword] = useState(''),
    [currentPassword, setCurrentPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let alive = true;
    setGate(null);
    setError('');
    void pilotRpc('pilot_operator_gate')
      .then((result) => {
        if (alive) setGate(result);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, tick]);
  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    if (password !== confirmation) {
      setError('Passwords must match.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await pilotAdmin({ action: 'change_password', password, current_password: currentPassword });
      setCurrentPassword('');
      setPassword('');
      setConfirmation('');
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation was not confirmed.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (gate?.ready && (!platform || gate.platform_admin)) return <>{children}</>;
  return (
    <section className="max-w-lg mx-auto p-6 my-8 bg-white border rounded-2xl space-y-4">
      <h1 className="text-xl font-bold text-[#16342b]">
        {gate?.must_change ? 'Choose your own password' : 'Verify operator access'}
      </h1>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!gate && !error && <p role="status">Checking server authorization…</p>}
      {gate?.must_change && !gate.expired && !gate.locked ? (
        <form onSubmit={change} className="space-y-4">
          <p>
            Your temporary credential cannot perform protected operations. Set a new password, then
            sign in again. This signs out existing sessions.
          </p>
          <label className="block">
            Current temporary password
            <input
              className="block w-full p-3 border rounded-lg"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="block">
            New password
            <input
              className="block w-full p-3 border rounded-lg"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block">
            Confirm new password
            <input
              className="block w-full p-3 border rounded-lg"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button disabled={busy} className="p-3 rounded-lg bg-[#16342b] text-white">
            {busy ? 'Activating…' : 'Change password and sign out'}
          </button>
        </form>
      ) : (
        gate && (
          <p role="alert">
            {gate.account_restricted
              ? 'Organization access is suspended or expired. Contact your platform administrator.'
              : gate.expired
                ? 'Your temporary credential expired. Ask your administrator for a reset.'
                : gate.locked
                  ? 'A credential reset is pending. Ask your administrator to finish it.'
                  : platform && !gate.platform_admin
                    ? 'Verified platform administrator access is required.'
                    : 'Sign in again to refresh authorization. If access is revoked or the account is suspended, contact your administrator.'}
          </p>
        )
      )}
      <button className="underline p-2" onClick={() => setTick((t) => t + 1)}>
        Retry authorization
      </button>
      <button className="underline p-2" onClick={() => void signOut()}>
        Sign out
      </button>
    </section>
  );
}
