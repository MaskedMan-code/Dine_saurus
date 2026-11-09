import React, { useEffect, useState, useCallback } from 'react';
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
  const { staff, isAdmin } = useAuth();
  const [tab, setTab] = useState<'customers' | 'staff'>('customers');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!staff) return;
    setLoading(true);
    const { data: custData } = await supabase
      .from('customers')
      .select('id, name, phone, points_balance, tier, created_at')
      .eq('organization_id', staff.organizationId)
      .order('created_at', { ascending: false });
    setCustomers(custData || []);

    const { data: memberData } = await supabase
      .from('organization_members')
      .select('id, user_id, role, is_active, created_at')
      .eq('organization_id', staff.organizationId)
      .order('created_at', { ascending: false });

    if (memberData && memberData.length > 0) {
      const userIds = memberData.map((m: any) => m.user_id);
      const { data: profileData } = await supabase.from('profiles').select('id, display_name, phone').in('id', userIds);
      const withProfiles = memberData.map((m: any) => {
        const p = (profileData || []).find((pr: any) => pr.id === m.user_id);
        return { ...m, profile_name: p?.display_name, profile_phone: p?.phone };
      });
      setStaffRows(withProfiles);
    } else {
      setStaffRows([]);
    }
    setLoading(false);
  }, [staff]);

  useEffect(() => { load(); }, [load]);

  const updateStaffRole = async (memberId: string, role: StaffRole) => {
    await supabase.from('organization_members').update({ role }).eq('id', memberId);
    setStaffRows(prev => prev.map(r => (r.id === memberId ? { ...r, role } : r)));
  };

  const toggleActive = async (memberId: string, isActive: boolean) => {
    await supabase.from('organization_members').update({ is_active: isActive }).eq('id', memberId);
    setStaffRows(prev => prev.map(r => (r.id === memberId ? { ...r, is_active: isActive } : r)));
    // keep staff_members status in sync for display purposes
    const row = staffRows.find(r => r.id === memberId);
    if (row) {
      await supabase.from('staff_members').update({ status: isActive ? 'active' : 'invited' }).eq('organization_id', staff!.organizationId).eq('user_id', row.user_id);
    }
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
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#16342b]" /></div>
      ) : tab === 'customers' ? (
        <div className="bg-white rounded-2xl border border-[#e5e3dd] overflow-hidden">
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
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[#9a9a9a]">
                  <UtensilsCrossed className="w-6 h-6 mx-auto mb-2" />
                  No customers have registered yet.
                </td></tr>
              )}
              {customers.map(c => (
                <tr key={c.id} className="border-t border-[#f0efe9]">
                  <td className="px-4 py-3 font-medium text-[#242424]">{c.name}</td>
                  <td className="px-4 py-3 text-[#6b6b6b]">{c.phone || '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-[#eef4f1] text-[#16342b] text-xs font-medium">{c.tier}</span></td>
                  <td className="px-4 py-3 text-[#6b6b6b]">{c.points_balance}</td>
                  <td className="px-4 py-3 text-[#9a9a9a] text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e5e3dd] overflow-hidden">
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
              {staffRows.map(s => (
                <tr key={s.id} className="border-t border-[#f0efe9]">
                  <td className="px-4 py-3 font-medium text-[#242424]">{s.profile_name || '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={s.role}
                      onChange={e => updateStaffRole(s.id, e.target.value as StaffRole)}
                      className="text-xs border border-[#e5e3dd] rounded-lg px-2 py-1 bg-white"
                    >
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {s.is_active ? 'Active' : 'Pending approval'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#9a9a9a] text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {s.is_active ? (
                      <button onClick={() => toggleActive(s.id, false)} className="flex items-center gap-1 text-xs text-red-600 hover:underline"><X className="w-3.5 h-3.5" /> Deactivate</button>
                    ) : (
                      <button onClick={() => toggleActive(s.id, true)} className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"><Check className="w-3.5 h-3.5" /> Approve</button>
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
