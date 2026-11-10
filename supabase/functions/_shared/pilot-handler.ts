import type { SupabaseClient } from '@supabase/supabase-js';

interface Dependencies {
  service: SupabaseClient;
  createUserClient: (token: string) => SupabaseClient;
  allowedOrigins: string[];
}
const isUuid = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export function temporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return 'aA9!' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
export function createPilotHandler({ service, createUserClient, allowedOrigins }: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (!allowedOrigins.includes(origin)) return respond({ error: 'Origin is not approved.' }, 403);
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization,apikey,content-type,x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST,OPTIONS';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: 'POST required.' }, 405);
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return respond({ error: 'Sign in first.' }, 401);
    try {
      const userClient = createUserClient(token);
      const auth = await userClient.auth.getUser(token);
      if (auth.error || !auth.data.user) return respond({ error: 'Session is not valid.' }, 401);
      const user = auth.data.user;
      // getUser validates the JWT before any claims are read; metadata never grants access.
      const jwt = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const iat = Number(jwt.iat);
      if (!Number.isSafeInteger(iat) || iat < 1)
        return respond({ error: 'Sign in again to refresh your session.' }, 401);
      const raw = await request.text();
      if (raw.length > 16000) return respond({ error: 'Request too large.' }, 413);
      const body = JSON.parse(raw);
      if (body.action === 'change_password') {
        const gate = await userClient.rpc('pilot_operator_gate');
        if (gate.error || !gate.data?.must_change || gate.data.expired || gate.data.locked)
          return respond(
            {
              error:
                'Password activation is unavailable or expired. Ask your administrator to reset credentials.',
            },
            403,
          );
        if (
          typeof body.password !== 'string' ||
          body.password.length < 12 ||
          body.password.length > 128
        )
          return respond({ error: 'Use a password of 12–128 characters.' }, 400);
        if (
          typeof body.current_password !== 'string' ||
          body.current_password.length > 128 ||
          body.current_password === body.password
        )
          return respond(
            { error: 'Enter the current password and choose a different new password.' },
            400,
          );
        const reauthenticated = await userClient.auth.signInWithPassword({
          email: user.email!,
          password: body.current_password,
        });
        if (reauthenticated.error || reauthenticated.data.user?.id !== user.id)
          return respond({ error: 'The current password was not verified.' }, 403);
        const changed = await service.auth.admin.updateUserById(user.id, {
          password: body.password,
        });
        if (changed.error)
          return respond(
            {
              error:
                'Auth did not confirm the new password. Check password requirements and retry.',
            },
            400,
          );
        const revoked = await service.auth.admin.signOut(token, 'global');
        if (revoked.error)
          return respond(
            {
              error:
                'Password changed, but session revocation was not confirmed. Sign in with the new password and retry activation.',
            },
            503,
          );
        const activated = await service.rpc('pilot_complete_password_change', {
          p_user_id: user.id,
        });
        if (activated.error)
          return respond(
            {
              error:
                'Password changed; activation is still blocked. Sign in with the new password and ask your administrator to check provisioning.',
            },
            503,
          );
        return respond({ stage: 'activated', sign_in_required: true });
      }
      if (
        !['restaurant', 'staff', 'reset'].includes(body.action) ||
        !isUuid(body.request_id) ||
        !body.payload ||
        typeof body.payload !== 'object' ||
        Array.isArray(body.payload)
      )
        return respond({ error: 'Invalid provisioning request.' }, 400);
      const payload = body.payload;
      if (
        body.action !== 'reset' &&
        (payload.email_verified !== true ||
          typeof payload.email !== 'string' ||
          typeof payload.display_name !== 'string' ||
          payload.display_name.trim().length < 2)
      )
        return respond({ error: 'Verify the recipient email and enter their name.' }, 400);
      const prepared = await service.rpc('pilot_prepare_provision', {
        p_actor: user.id,
        p_iat: iat,
        p_request_id: body.request_id,
        p_kind: body.action,
        p_payload: payload,
      });
      if (prepared.error || !prepared.data)
        return respond(
          {
            error:
              'Provisioning was not authorized or the details conflict. Check role, email, location and limits; retry this request before starting another.',
          },
          403,
        );
      const operation = prepared.data;
      if (operation.stage === 'completed')
        return respond({ ...operation, credential_available: false });
      const password = temporaryPassword();
      let target = operation.target_user_id as string | null;
      if (target) {
        const reset = await service.auth.admin.updateUserById(target, { password });
        if (reset.error)
          return respond(
            {
              error:
                'Auth did not confirm the credential. Retry the same request; no new membership was confirmed.',
            },
            503,
          );
      } else {
        const created = await service.auth.admin.createUser({
          email: operation.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: payload.display_name },
          app_metadata: { pilot_provisioning_id: body.request_id },
        });
        if (created.error || !created.data.user)
          return respond(
            {
              error:
                'Auth creation was not confirmed. Retry the same request to reconcile it safely.',
            },
            503,
          );
        target = created.data.user.id;
      }
      const completed = await service.rpc('pilot_finish_provision', {
        p_actor: user.id,
        p_iat: iat,
        p_request_id: body.request_id,
        p_user_id: target,
      });
      if (completed.error || !completed.data)
        return respond(
          {
            error:
              'Auth exists, but restaurant access was not confirmed. Retry the same request; do not create another account.',
          },
          503,
        );
      return respond({
        ...completed.data,
        email: operation.email,
        temporary_password: password,
        expires_in_hours: 24,
        delivery: 'manual_secure_channel',
      });
    } catch {
      // Never log request bodies, bearer tokens, passwords or raw Auth/SQL errors.
      return respond(
        { error: 'The request was not confirmed. Preserve its request ID and retry.' },
        503,
      );
    }
  };
}
