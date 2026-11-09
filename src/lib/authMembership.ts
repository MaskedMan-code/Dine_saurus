import type { StaffRecord, StaffRole } from '../context/AuthContext';
export interface MembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: StaffRole;
  is_active: boolean;
}
export interface StaffRow {
  id: string;
  organization_id: string;
  user_id: string;
  status: string;
}
export function resolveMembership(
  rows: MembershipRow[],
  employees: StaffRow[],
  preferred: string | null,
): StaffRecord | null {
  const rank: Record<StaffRole, number> = { owner: 0, admin: 1, manager: 2, staff: 3 };
  const mapped = rows
    .filter((r) => Object.hasOwn(rank, r.role))
    .map((r) => {
      const employee = employees.find(
        (s) => s.organization_id === r.organization_id && s.user_id === r.user_id,
      );
      const active =
        r.is_active &&
        (employee ? employee.status === 'active' : ['owner', 'admin'].includes(r.role));
      return {
        id: r.id,
        organizationId: r.organization_id,
        userId: r.user_id,
        role: r.role,
        isActive: active,
        status: employee?.status ?? (active ? 'active' : 'pending'),
      };
    });
  return (
    mapped.sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        Number(b.organizationId === preferred) - Number(a.organizationId === preferred) ||
        rank[a.role] - rank[b.role] ||
        a.organizationId.localeCompare(b.organizationId),
    )[0] ?? null
  );
}
