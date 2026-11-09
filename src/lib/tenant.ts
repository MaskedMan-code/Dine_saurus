import { supabase } from './supabase';

export async function resolveOrgByCode(code: string): Promise<{ organizationId: string; organizationName: string } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase.rpc('resolve_org_by_code', { p_code: trimmed });
  if (error || !data || data.length === 0) return null;
  return { organizationId: data[0].organization_id, organizationName: data[0].organization_name };
}
