import { createClient } from '@supabase/supabase-js';
import { createPilotHandler } from '../_shared/pilot-handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const handler = createPilotHandler({
  service: createClient(url, secret, options),
  createUserClient: (token) =>
    createClient(url, anon, {
      ...options,
      global: { headers: { Authorization: `Bearer ${token}` } },
    }),
  allowedOrigins: (Deno.env.get('PILOT_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
});
Deno.serve(handler);
