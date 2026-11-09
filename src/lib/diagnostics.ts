export function diagnostic(event: string, details: Record<string, unknown> = {}) {
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_LIFECYCLE === 'true')
    console.debug('[Dine_saurus]', event, details);
}
export function installDiagnostics() {
  if (!import.meta.env.DEV || import.meta.env.VITE_DEBUG_LIFECYCLE !== 'true') return;
  const navigation = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  diagnostic('document-start', {
    navigation: navigation?.type,
    timeOrigin: performance.timeOrigin,
  });
  document.addEventListener('visibilitychange', () =>
    diagnostic('visibility', { state: document.visibilityState }),
  );
  window.addEventListener('pageshow', (e) =>
    diagnostic('pageshow', { restoredFromCache: e.persisted }),
  );
  import.meta.hot?.on('vite:beforeUpdate', () => diagnostic('vite-hmr'));
}
