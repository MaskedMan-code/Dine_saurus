import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError: string | null =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? 'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env or .env.local file at the project root (see .env.example), then restart the dev server.'
    : null;

// We still construct a client even when config is missing, using placeholder values, so that
// importing this module never crashes the whole app at parse time. App.tsx checks
// `supabaseConfigError` and renders a clear configuration screen instead of any Supabase calls.
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.invalid',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

export interface ConnectionStatus {
  connected: boolean;
  message: string;
}

/**
 * Actually verifies connectivity + auth to Supabase by making a real query and inspecting
 * the response for an error, rather than assuming success just because the client constructed.
 */
export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  if (supabaseConfigError) {
    return { connected: false, message: supabaseConfigError };
  }
  try {
    const { error } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return { connected: false, message: `Supabase query failed: ${error.message}` };
    }
    return { connected: true, message: 'Connected to Supabase' };
  } catch (err: any) {
    return {
      connected: false,
      message: `Could not reach Supabase: ${err?.message || 'network error'}`,
    };
  }
}
