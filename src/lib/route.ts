import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage';
export const VIEW_MODES = [
  'customer',
  'pos',
  'kds',
  'tables',
  'menu',
  'service_desk',
  'analytics',
  'loyalty_admin',
  'settings',
  'admin_users',
] as const;
export type AppViewMode = (typeof VIEW_MODES)[number];
export function getViewMode(search = window.location.search): AppViewMode {
  const p = new URLSearchParams(search);
  const view = p.get('view');
  if (view && VIEW_MODES.includes(view as AppViewMode)) return view as AppViewMode;
  if (p.has('table') || p.has('restaurant')) return 'customer';
  const saved = readStorage('dinesaurus:view', 'session');
  return saved && VIEW_MODES.includes(saved as AppViewMode) ? (saved as AppViewMode) : 'pos';
}
const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
};
export function useRouteView() {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  return { viewMode: getViewMode(search), search };
}
export function navigateView(mode: AppViewMode) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', mode);
  if (mode !== 'customer') {
    url.searchParams.delete('table');
    url.searchParams.delete('restaurant');
    url.searchParams.delete('loc');
  }
  writeStorage('dinesaurus:view', mode, 'session');
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
export function qrUrl(token: string, origin = window.location.origin) {
  if (!token)
    throw new Error('This table has no saved QR code. Save the table again to create one.');
  const url = new URL('/', origin);
  url.searchParams.set('view', 'customer');
  url.searchParams.set('table', token);
  return url.toString();
}
