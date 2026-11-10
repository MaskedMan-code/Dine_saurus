import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { submitProvision } from '../../lib/pilot';

export function CredentialResult({ result, onClear }: { result: any; onClear: () => void }) {
  return (
    <div role="status" className="p-4 border border-amber-300 bg-amber-50 rounded-xl space-y-2">
      {result.temporary_password ? (
        <>
          <p className="font-semibold">
            Credential created — deliver through your approved secure channel.
          </p>
          <p>Email: {result.email || 'Existing account'}</p>
          <label className="block">
            Temporary password
            <input
              readOnly
              className="w-full font-mono p-2 border"
              value={result.temporary_password}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p>
            Shown only in this session. Expires in 24 hours; the recipient must change it before
            using staff tools. No message has been sent.
          </p>
        </>
      ) : (
        <p>
          This request was already completed. The credential cannot be recovered; use an authorized
          reset if delivery was interrupted.
        </p>
      )}
      <button type="button" className="underline p-2" onClick={onClear}>
        Clear credential from screen
      </button>
    </div>
  );
}
export function ProvisionForm({
  organizationId,
  locations = [],
}: {
  organizationId?: string;
  locations?: { id: string; name: string }[];
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [organization, setOrganization] = useState('');
  const [country, setCountry] = useState('IN'),
    [currency, setCurrency] = useState('INR'),
    [timezone, setTimezone] = useState('Asia/Kolkata');
  const [duty, setDuty] = useState('cashier'),
    [assigned, setAssigned] = useState<string[]>([]),
    [verified, setVerified] = useState(false);
  const [result, setResult] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const payload = organizationId
      ? {
          organization_id: organizationId,
          email: email.trim().toLowerCase(),
          display_name: name.trim(),
          email_verified: verified,
          duty,
          location_ids: [...assigned].sort(),
        }
      : {
          organization_name: organization.trim(),
          country_code: country.trim().toUpperCase(),
          currency: currency.trim().toUpperCase(),
          timezone: timezone.trim(),
          email: email.trim().toLowerCase(),
          display_name: name.trim(),
          email_verified: verified,
        };
    try {
      setResult(
        await submitProvision(
          `${user?.id}:${organizationId || 'platform'}`,
          organizationId ? 'staff' : 'restaurant',
          payload,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Provisioning was not confirmed.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="my-5 p-5 border bg-white rounded-xl space-y-4">
      <h2 className="text-lg font-semibold">
        {organizationId ? 'Provision a staff account' : 'Provision a restaurant owner'}
      </h2>
      {result ? (
        <CredentialResult result={result} onClear={() => setResult(null)} />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {!organizationId && (
            <>
              <label className="block">
                Organization name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="block p-2 border rounded-lg w-full"
                />
              </label>
              <div className="grid sm:grid-cols-3 gap-2">
                <label>
                  Country code
                  <input
                    required
                    maxLength={2}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="block p-2 border rounded-lg w-full"
                  />
                </label>
                <label>
                  Currency
                  <input
                    required
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="block p-2 border rounded-lg w-full"
                  />
                </label>
                <label>
                  Timezone
                  <input
                    required
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="block p-2 border rounded-lg w-full"
                  />
                </label>
              </div>
              <p className="text-sm">
                The owner completes restaurant, location and table setup after activating their
                password.
              </p>
            </>
          )}
          <label className="block">
            {organizationId ? 'Staff name' : 'Owner name'}
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block p-2 border rounded-lg w-full"
            />
          </label>
          <label className="block">
            Account email
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block p-2 border rounded-lg w-full"
            />
          </label>
          {organizationId && (
            <>
              <label className="block">
                Duty
                <select
                  value={duty}
                  onChange={(e) => setDuty(e.target.value)}
                  className="block p-2 border rounded-lg"
                >
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="waiter">Waiter</option>
                  <option value="kitchen">Kitchen staff</option>
                  <option value="other">Other staff</option>
                </select>
              </label>
              <fieldset>
                <legend>Location assignments</legend>
                {locations.map((l) => (
                  <label key={l.id} className="block">
                    <input
                      type="checkbox"
                      checked={assigned.includes(l.id)}
                      onChange={(e) =>
                        setAssigned((prev) =>
                          e.target.checked ? [...prev, l.id] : prev.filter((id) => id !== l.id),
                        )
                      }
                    />{' '}
                    {l.name}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <label className="block text-sm">
            <input
              type="checkbox"
              required
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />{' '}
            I verified the recipient email and have an approved secure delivery channel.
          </label>
          <button
            disabled={busy || (!!organizationId && !assigned.length)}
            className="p-3 bg-[#16342b] text-white rounded-lg disabled:opacity-50"
          >
            {busy ? 'Provisioning…' : 'Create account'}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
