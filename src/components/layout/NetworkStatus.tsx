import React, { useSyncExternalStore } from 'react';
const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};
export function NetworkStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  return online ? null : (
    <p
      role="status"
      className="sticky top-0 z-[100] p-3 bg-amber-100 text-amber-950 text-center text-sm"
    >
      You are offline. Saved drafts stay on this device. Orders and payments need a confirmed server
      response; reconnect before retrying.
    </p>
  );
}
