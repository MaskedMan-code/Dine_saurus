import { StaffDutyEditor } from './StaffDutyEditor';
import { ProvisionForm, CredentialResult } from './ProvisionForm';
import { submitProvision } from '../../lib/pilot';
import { useRestaurant } from '../../context/RestaurantContext';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth, StaffRole } from '../../context/AuthContext';
import { Users, ShieldCheck, UtensilsCrossed, Loader2, RefreshCw, Check, X } from 'lucide-react';

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  points_balance: number;
  tier: string;
  created_at: string;
}

interface StaffRow {
  id: string;
  user_id: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  profile_name?: string;
  profile_phone?: string;
}

const ROLE_OPTIONS: StaffRole[] = ['owner', 'admin', 'manager', 'staff'];

export const AdminUsersView: React.FC = () => {
  const { staff, isAdmin, user } = useAuth();
  const { restaurant } = useRestaurant();
  const [assignment, setAssignment] = useState<StaffRow | null>(null);
  const [activity, setActivity] = useState<any[] | null>(null);
  const [credential, setCredential] = useState<any>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [tab, setTab] = useState<'customers' | 'staff'>('customers');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const orgId = staff?.organizationId;
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId || !isAdmin) return;
    const version = ++request.current;
    setError(null);
    setLoading(true);
    const { data: custData, error: customerError } = await supabase
      .from('customers')
      .select('id, name, phone, points_balance, tier, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (version !== request.current) return;
    if (customerError) {
      setError(customerError.message);
      setLoading(false);
      return;
    }
    setCustomers(custData || []);

    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('id, user_id, role, is_active, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (version !== request.current) return;
    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }
    if (memberData && memberData.length > 0) {
      const userIds = memberData.map((m: any) => m.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, phone')
        .in('id', userIds);
      if (version !== request.current) return;
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
      const withProfiles = memberData.map((m: any) => {
        const p = (profileData || []).find((pr: any) => pr.id === m.user_id);
        return { ...m, profile_name: p?.display_name, profile_phone: p?.phone };
      });
      setStaffRows(withProfiles);
    } else {
      setStaffRows([]);
    }
    setLoading(false);
  }, [orgId, isAdmin]);

  useEffect(() => {
    const invalidate = () => {
      request.current++;
    };
    void load();
    return invalidate;
  }, [load]);

  const saveAccess = async (memberId: string, role: StaffRole, active: boolean) => {
    setError(null);
    const { data, error } = await supabase.rpc('set_staff_access', {
      p_member_id: memberId,
      p_role: role,
      p_active: active,
    });
    if (error || !data) {
      setError(error?.message || 'The access change was not confirmed.');
      return;
    }
    await load();
  };
  const updateStaffRole = async (memberId: string, role: StaffRole) => {
    const row = staffRows.find((r) => r.id === memberId);
    if (row) await saveAccess(memberId, role, row.is_active);
  };
  const toggleActive = async (memberId: string, active: boolean) => {
    const row = staffRows.find((r) => r.id === memberId);
    if (row) await saveAccess(memberId, row.role, active);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="text-center text-sm text-[#6b6b6b] max-w-sm">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[#9a9a9a]" />
          Only owners and admins can view registered users. Ask an owner to grant you admin access.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {staff?.role === 'owner' && (
        <ProvisionForm organizationId={orgId} locations={restaurant?.locations || []} />
      )}
      {credential && <CredentialResult result={credential} onClear={() => setCredential(null)} />}
      {assignment && orgId && (
        <StaffDutyEditor
          member={assignment.id}
          user={assignment.user_id}
          org={orgId}
          locations={restaurant?.locations || []}
          onClose={() => setAssignment(null)}
          onSaved={() => {
            setAssignment(null);
            void load();
          }}
        />
      )}
      <button
        className="underline p-2"
        onClick={async () => {
          const result = await supabase
            .from('audit_logs')
            .select('id,action,entity_type,created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(30);
          if (result.error) setError(result.error.message);
          else setActivity(result.data || []);
        }}
      >
        Review recent activity
      </button>
      {activity && (
        <section className="my-3 p-3 border rounded-xl">
          <h2 className="font-semibold">Recent organization activity</h2>
          {activity.length ? (
            activity.map((a) => (
              <p key={a.id} className="text-sm p-2 border-b">
                {a.action} · {a.entity_type} · {new Date(a.created_at).toLocaleString()}
              </p>
            ))
          ) : (
            <p>No activity recorded.</p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="p-3 bg-red-50 text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#16342b]" />
          <h1 className="text-xl font-semibold text-[#242424]">Registered Users</h1>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-medium text-[#16342b] bg-[#eef4f1] hover:bg-[#e0ece6] px-3 py-1.5 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-5 border-b border-[#e5e3dd]">
        <button
          onClick={() => setTab('customers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'customers' ? 'border-[#16342b] text-[#16342b]' : 'border-transparent text-[#8a8a8a]'}`}
        >
          Customers ({customers.length})
        </button>
        <button
          onClick={() => setTab('staff')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'staff' ? 'border-[#16342b] text-[#16342b]' : 'border-transparent text-[#8a8a8a]'}`}
        >
          Staff ({staffRows.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#16342b]" />
        </div>
      ) : tab === 'customers' ? (
        <div className="bg-white rounded-2xl border border-[#e5e3dd] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f9f9f7] text-[#8a8a8a] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-left px-4 py-3 font-medium">Points</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#9a9a9a]">
                    <UtensilsCrossed className="w-6 h-6 mx-auto mb-2" />
                    No customers have registered yet.
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-[#f0efe9]">
                  <td className="px-4 py-3 font-medium text-[#242424]">{c.name}</td>
                  <td className="px-4 py-3 text-[#6b6b6b]">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-[#eef4f1] text-[#16342b] text-xs font-medium">
                      {c.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6b6b6b]">{c.points_balance}</td>
                  <td className="px-4 py-3 text-[#9a9a9a] text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e5e3dd] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f9f9f7] text-[#8a8a8a] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((s) => (
                <tr key={s.id} className="border-t border-[#f0efe9]">
                  <td className="px-4 py-3 font-medium text-[#242424]">{s.profile_name || '—'}</td>
                  <td className="px-4 py-3">
                    {staff?.role === 'owner' && !['owner', 'admin'].includes(s.role) && (
                      <button
                        disabled={resetBusy}
                        className="underline block p-2"
                        onClick={async () => {
                          if (resetBusy) return;
                          setResetBusy(true);
                          setError(null);
                          try {
                            setCredential(
                              await submitProvision(`${user?.id}:reset:${s.id}`, 'reset', {
                                organization_id: orgId,
                                member_id: s.id,
                              }),
                            );
                          } catch (e) {
                            setError(
                              e instanceof Error ? e.message : 'Credential reset not confirmed.',
                            );
                          } finally {
                            setResetBusy(false);
                          }
                        }}
                      >
                        Reset temporary credential
                      </button>
                    )}
                    {staff?.role === 'owner' && !['owner', 'admin'].includes(s.role) && (
                      <button className="underline block p-2" onClick={() => setAssignment(s)}>
                        Edit duty and locations
                      </button>
                    )}
                    <select
                      value={s.role}
                      onChange={(e) => updateStaffRole(s.id, e.target.value as StaffRole)}
                      className="text-xs border border-[#e5e3dd] rounded-lg px-2 py-1 bg-white"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                    >
                      {s.is_active ? 'Active' : 'Pending approval'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#9a9a9a] text-xs">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_active ? (
                      <button
                        onClick={() => toggleActive(s.id, false)}
                        className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                      >
                        <X className="w-3.5 h-3.5" /> Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleActive(s.id, true)}
                        className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
