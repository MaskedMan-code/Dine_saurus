import React, { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { resolveMembership } from '../src/lib/authMembership';

const mock = vi.hoisted(() => ({
  listeners: new Set<(event: string, session: any) => void>(),
  from: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  signIn: vi.fn(),
  insideCallback: false,
}));
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: mock.from,
    auth: {
      getSession: mock.getSession,
      onAuthStateChange: (callback: any) => {
        mock.listeners.add(callback);
        return { data: { subscription: { unsubscribe: () => mock.listeners.delete(callback) } } };
      },
      signInWithPassword: mock.signIn,
      signOut: mock.signOut,
    },
  },
}));
const session = (id: string, token = 'token') => ({
  user: { id, email: `${id}@example.test` },
  access_token: token,
});
function emit(event: string, value: any) {
  mock.insideCallback = true;
  mock.listeners.forEach((fn) => fn(event, value));
  mock.insideCallback = false;
}
function query(result: any) {
  const chain: any = {};
  for (const k of ['select', 'eq', 'order', 'abortSignal', 'single']) chain[k] = () => chain;
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}
const owner = (user = 'owner') => ({
  id: 'member',
  organization_id: 'org',
  user_id: user,
  role: 'owner' as const,
  is_active: true,
});
function Probe() {
  const a = useAuth();
  return (
    <>
      <span data-testid="user">{a.user?.id ?? 'signed-out'}</span>
      <span data-testid="role">{a.staff?.role ?? 'none'}</span>
      <span data-testid="error">{a.profileError}</span>
      <span data-testid="busy">{String(a.loading)}</span>
      <button onClick={() => void a.signOut()}>Logout</button>
    </>
  );
}
beforeEach(() => {
  mock.listeners.clear();
  mock.insideCallback = false;
  mock.from.mockReset();
  mock.getSession.mockReset();
  mock.signOut.mockReset();
  mock.signIn.mockReset();
  mock.getSession.mockResolvedValue({ data: { session: session('owner') }, error: null });
  mock.from.mockImplementation((table: string) => {
    expect(mock.insideCallback).toBe(false);
    return query({
      data:
        table === 'profiles'
          ? { id: 'owner', display_name: 'Owner', phone: null }
          : table === 'organization_members'
            ? [owner()]
            : table === 'staff_members'
              ? [{ id: 'staff', organization_id: 'org', user_id: 'owner', status: 'active' }]
              : [],
      error: null,
    });
  });
  mock.signOut.mockImplementation(async () => {
    emit('SIGNED_OUT', null);
    return { error: null };
  });
});
test('restores a session and resolves membership separately from employee status', async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('owner'));
  expect(mock.from.mock.calls.map((c) => c[0])).toEqual([
    'profiles',
    'organization_members',
    'staff_members',
    'customers',
  ]);
});
test('token refresh and same-user sign-in do not reload profile data', async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('owner'));
  const before = mock.from.mock.calls.length;
  await act(async () => {
    emit('TOKEN_REFRESHED', session('owner', 'new-token'));
    emit('SIGNED_IN', session('owner', 'newer-token'));
  });
  expect(mock.from).toHaveBeenCalledTimes(before);
  expect(screen.getByTestId('role')).toHaveTextContent('owner');
});
test('missing profile retains authentication and exposes an authorization error', async () => {
  mock.from.mockImplementation(() => query({ data: null, error: null }));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('profile is missing'));
  expect(screen.getByTestId('user')).toHaveTextContent('owner');
});
test('a delayed initial session cannot undo sign-out', async () => {
  let resolve: any;
  mock.getSession.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await act(async () => emit('SIGNED_OUT', null));
  await act(async () => resolve({ data: { session: session('old') }, error: null }));
  expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
  expect(mock.from).not.toHaveBeenCalled();
});
test('stale profile results cannot restore access after logout', async () => {
  let resolve: any;
  const pending = new Promise((r) => {
    resolve = r;
  });
  mock.from.mockImplementation(() => query(pending));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(mock.from).toHaveBeenCalled());
  await act(async () => emit('SIGNED_OUT', null));
  await act(async () => resolve({ data: [], error: null }));
  expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
  expect(screen.getByTestId('role')).toHaveTextContent('none');
});
test('StrictMode keeps one live auth listener and removes it on unmount', async () => {
  const view = render(
    <StrictMode>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </StrictMode>,
  );
  await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('owner'));
  expect(mock.listeners.size).toBe(1);
  view.unmount();
  expect(mock.listeners.size).toBe(0);
});
test('organization choice is deterministic and inactive employees fail closed', () => {
  const rows = [
    { ...owner(), id: 'b', organization_id: 'b', role: 'staff' as const },
    { ...owner(), id: 'a', organization_id: 'a', role: 'manager' as const },
  ];
  const employees = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    organization_id: r.organization_id,
    status: r.id === 'b' ? 'invited' : 'active',
  }));
  expect(resolveMembership(rows, employees, 'b')).toMatchObject({
    organizationId: 'a',
    role: 'manager',
    isActive: true,
  });
  expect(resolveMembership([{ ...owner(), role: 'staff' }], [], null)?.isActive).toBe(false);
  expect(resolveMembership([owner()], [], null)?.isActive).toBe(true);
});
