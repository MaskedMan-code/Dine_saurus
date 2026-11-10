// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import { createPilotHandler, temporaryPassword } from '../supabase/functions/_shared/pilot-handler';
const actor = '00000000-0000-4000-8000-000000000001',
  target = '00000000-0000-4000-8000-000000000002',
  requestId = '00000000-0000-4000-8000-000000000003';
const token =
  'header.' +
  Buffer.from(JSON.stringify({ sub: actor, iat: 1770000000, role: 'authenticated' })).toString(
    'base64url',
  ) +
  '.signature';
const allowed = 'https://pilot.example.test';
let events: string[], service: any, user: any, handler: (r: Request) => Promise<Response>;
beforeEach(() => {
  events = [];
  user = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: actor, email: 'owner@example.test' } },
        error: null,
      })),
      signInWithPassword: vi.fn(async () => ({ data: { user: { id: actor } }, error: null })),
    },
    rpc: vi.fn(async () => ({
      data: { must_change: true, expired: false, locked: false },
      error: null,
    })),
  };
  service = {
    rpc: vi.fn(async (name: string) => {
      events.push(name);
      return {
        data:
          name === 'pilot_prepare_provision'
            ? { stage: 'reserved', email: 'staff@example.test', target_user_id: null }
            : { stage: 'completed', user_id: target },
        error: null,
      };
    }),
    auth: {
      admin: {
        createUser: vi.fn(async () => {
          events.push('createUser');
          return { data: { user: { id: target } }, error: null };
        }),
        updateUserById: vi.fn(async () => {
          events.push('updateUser');
          return { data: { user: { id: target } }, error: null };
        }),
        signOut: vi.fn(async () => {
          events.push('revoke');
          return { error: null };
        }),
      },
    },
  };
  handler = createPilotHandler({
    service,
    createUserClient: () => user,
    allowedOrigins: [allowed],
  });
});
const request = (body: any, origin = allowed, bearer = token) =>
  new Request('https://backend.example.test/functions/v1/pilot-admin', {
    method: 'POST',
    headers: { origin, authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const provision = () => ({
  action: 'staff',
  request_id: requestId,
  payload: {
    email: 'staff@example.test',
    display_name: 'New Staff',
    email_verified: true,
    duty: 'cashier',
  },
});
test('rejects unapproved origins and unverified sessions before any service-role write', async () => {
  expect((await handler(request(provision(), 'https://unapproved.test'))).status).toBe(403);
  user.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'forged' } });
  expect((await handler(request(provision()))).status).toBe(401);
  expect(service.rpc).not.toHaveBeenCalled();
});
test('checks authoritative authorization before Auth creation, never browser metadata', async () => {
  service.rpc.mockResolvedValueOnce({ data: null, error: { message: 'access denied' } });
  expect(
    (await handler(request({ ...provision(), role: 'owner', platform_admin: true }))).status,
  ).toBe(403);
  expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  expect(service.rpc).toHaveBeenCalledWith(
    'pilot_prepare_provision',
    expect.objectContaining({ p_actor: actor, p_iat: 1770000000 }),
  );
});
test('returns a unique credential once and never stores it in SQL arguments', async () => {
  const result = await handler(request(provision()));
  const data = await result.json();
  expect(result.status).toBe(200);
  expect(data.temporary_password.length).toBeGreaterThanOrEqual(64);
  expect(data.delivery).toBe('manual_secure_channel');
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(events).toEqual(['pilot_prepare_provision', 'createUser', 'pilot_finish_provision']);
  expect(service.auth.admin.createUser).toHaveBeenCalledWith(
    expect.objectContaining({
      email_confirm: true,
      app_metadata: { pilot_provisioning_id: requestId },
    }),
  );
  expect(JSON.stringify(service.rpc.mock.calls)).not.toContain(data.temporary_password);
  expect(temporaryPassword()).not.toBe(temporaryPassword());
});
test('completed retries do not reset credentials or create another account', async () => {
  service.rpc.mockResolvedValueOnce({
    data: { stage: 'completed', target_user_id: target },
    error: null,
  });
  const data = await (await handler(request(provision()))).json();
  expect(data.credential_available).toBe(false);
  expect(data.temporary_password).toBeUndefined();
  expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  expect(service.auth.admin.updateUserById).not.toHaveBeenCalled();
});
test('partial Auth/database failures remain unconfirmed with a recoverable request ID', async () => {
  service.rpc
    .mockResolvedValueOnce({
      data: { stage: 'reserved', email: 'staff@example.test', target_user_id: target },
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: { message: 'database unavailable' } });
  expect((await handler(request(provision()))).status).toBe(503);
  expect(service.auth.admin.updateUserById).toHaveBeenCalledWith(
    target,
    expect.objectContaining({ password: expect.any(String) }),
  );
  expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  expect(service.rpc.mock.calls[1][1].p_request_id).toBe(requestId);
});
test('password activation requires current-password verification and successful global revocation', async () => {
  const body = {
    action: 'change_password',
    current_password: 'temporary-password',
    password: 'new-private-password',
  };
  expect((await handler(request(body))).status).toBe(200);
  expect(user.auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'owner@example.test',
    password: body.current_password,
  });
  expect(events).toEqual(['updateUser', 'revoke', 'pilot_complete_password_change']);
  expect(service.auth.admin.updateUserById).toHaveBeenCalledWith(actor, {
    password: body.password,
  });
  expect(service.auth.admin.signOut).toHaveBeenCalledWith(token, 'global');
});
test('failed reauthentication or session revocation cannot release the database password gate', async () => {
  const body = {
    action: 'change_password',
    current_password: 'temporary-password',
    password: 'new-private-password',
  };
  user.auth.signInWithPassword.mockResolvedValueOnce({
    data: { user: null },
    error: { message: 'invalid' },
  });
  expect((await handler(request(body))).status).toBe(403);
  expect(service.auth.admin.updateUserById).not.toHaveBeenCalled();
  service.auth.admin.signOut.mockResolvedValueOnce({ error: { message: 'offline' } });
  expect((await handler(request(body))).status).toBe(503);
  expect(service.rpc).not.toHaveBeenCalledWith('pilot_complete_password_change', expect.anything());
});
