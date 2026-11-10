import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { pilotRpc } from '../../lib/pilot';
export function StaffDutyEditor({
  member,
  user,
  org,
  locations,
  onClose,
  onSaved,
}: {
  member: string;
  user: string;
  org: string;
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [duty, setDuty] = useState('other'),
    [assigned, setAssigned] = useState<string[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [d, s] = await Promise.all([
          supabase.from('pilot_staff_duties').select('duty').eq('member_id', member).maybeSingle(),
          supabase
            .from('staff_members')
            .select('id')
            .eq('user_id', user)
            .eq('organization_id', org)
            .single(),
        ]);
        if (d.error || s.error) throw new Error(d.error?.message || s.error?.message);
        const a = await supabase
          .from('staff_location_assignments')
          .select('location_id')
          .eq('staff_member_id', s.data.id);
        if (a.error) throw new Error(a.error.message);
        if (alive) {
          setDuty(d.data?.duty || 'other');
          setAssigned((a.data || []).map((x) => x.location_id));
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Assignments could not load.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [member, user, org]);
  return (
    <form
      className="my-4 p-4 border rounded-xl space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || loading) return;
        setBusy(true);
        setError('');
        try {
          await pilotRpc('pilot_set_staff_duty', {
            p_member: member,
            p_duty: duty,
            p_locations: assigned,
          });
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Assignments not saved.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">Edit duty and locations</h2>
      {loading ? (
        <p role="status">Loading assignments…</p>
      ) : (
        <>
          <label>
            Duty
            <select
              value={duty}
              onChange={(e) => setDuty(e.target.value)}
              className="p-2 border ml-2"
            >
              {['manager', 'cashier', 'waiter', 'kitchen', 'other'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {locations.map((l) => (
            <label key={l.id} className="block">
              <input
                type="checkbox"
                checked={assigned.includes(l.id)}
                onChange={(e) =>
                  setAssigned((prev) =>
                    e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id),
                  )
                }
              />{' '}
              {l.name}
            </label>
          ))}
          <button disabled={busy || !assigned.length} className="p-2 border rounded-lg">
            Save duty and assignments
          </button>
        </>
      )}
      <button type="button" className="p-2 underline" onClick={onClose}>
        Close assignments
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
