import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pilotRpc, submitProvision } from '../../lib/pilot';
import { ProvisionForm, CredentialResult } from './ProvisionForm';

function AccountForm({ row, onSave }: { row: any; onSave: () => void }) {
  const { user } = useAuth();
  const [credential, setCredential] = useState<any>(null);
  const a = row.account;
  const [status, setStatus] = useState(a?.status || 'trial'),
    [until, setUntil] = useState(a?.access_until?.slice(0, 10) || '');
  const [users, setUsers] = useState(a?.max_users || 10),
    [locations, setLocations] = useState(a?.max_locations || 1);
  const [billing, setBilling] = useState(a?.billing_enabled ?? true),
    [kot, setKot] = useState(a?.kot_enabled ?? true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await pilotRpc('pilot_set_account', {
        p_org: row.id,
        p_status: status,
        p_until: until ? new Date(`${until}T23:59:59Z`).toISOString() : null,
        p_max_locations: Number(locations),
        p_max_users: Number(users),
        p_billing: billing,
        p_kot: kot,
      });
      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account update failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="p-4 border rounded-xl space-y-3">
      <h3 className="font-semibold">{row.name}</h3>
      <p className="text-xs break-all">{row.id}</p>
      {row.owners?.map((owner: any) => (
        <div key={owner.member_id} className="text-sm">
          <span>{owner.email}</span>
          <button
            type="button"
            disabled={busy}
            className="underline p-2"
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                setCredential(
                  await submitProvision(`${user?.id}:platform-reset:${owner.member_id}`, 'reset', {
                    organization_id: row.id,
                    member_id: owner.member_id,
                  }),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Reset not confirmed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Reset owner temporary credential
          </button>
        </div>
      ))}
      {credential && <CredentialResult result={credential} onClear={() => setCredential(null)} />}
      <label className="block">
        Status
        <select
          className="border p-2 ml-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {['trial', 'active', 'suspended', 'expired'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Access through (UTC)
        <input
          type="date"
          className="border p-2 ml-2"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </label>
      <label className="block">
        User limit
        <input
          type="number"
          min={1}
          max={1000}
          className="border p-2 ml-2 w-24"
          value={users}
          onChange={(e) => setUsers(e.target.value)}
        />
      </label>
      <label className="block">
        Location limit
        <input
          type="number"
          min={1}
          max={100}
          className="border p-2 ml-2 w-24"
          value={locations}
          onChange={(e) => setLocations(e.target.value)}
        />
      </label>
      <label className="block">
        <input type="checkbox" checked={billing} onChange={(e) => setBilling(e.target.checked)} />{' '}
        Billing enabled
      </label>
      <label className="block">
        <input type="checkbox" checked={kot} onChange={(e) => setKot(e.target.checked)} /> KOT
        enabled
      </label>
      <button disabled={busy} className="p-2 border rounded-lg">
        Save account controls
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function PlatformAdminView() {
  const { signOut } = useAuth();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setData(await pilotRpc('pilot_platform_overview'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load provisioning.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#16342b]">Dine_saurus platform administration</h1>
        <button className="underline" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
      <p>
        Platform access is separate from restaurant ownership. All account controls and provisioning
        are checked by the backend.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <ProvisionForm />
      <button className="underline" onClick={() => void load()}>
        Refresh provisioning status
      </button>
      <section className="grid md:grid-cols-2 gap-4">
        {data?.accounts?.map((row: any) => (
          <AccountForm
            key={row.id + JSON.stringify(row.account)}
            row={row}
            onSave={() => void load()}
          />
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Provisioning status</h2>
        {data?.operations?.length ? (
          data.operations.map((op: any) => (
            <p key={op.id} className="p-2 border-b text-sm break-all">
              {op.kind} · {op.stage} · {op.id} · {new Date(op.created_at).toLocaleString()}
            </p>
          ))
        ) : (
          <p>No provisioning requests recorded.</p>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Recent audit activity</h2>
        {data?.audit?.map((a: any) => (
          <p key={a.id} className="text-sm p-2 border-b">
            {a.action} · {a.entity_type} · {new Date(a.created_at).toLocaleString()}
          </p>
        ))}
      </section>
    </main>
  );
}
