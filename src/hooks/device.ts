import { useEffect, useSyncExternalStore } from 'react';

/** Keep the screen awake while `active`; re-acquires after the tab comes back. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible' && !cancelled) lock = await navigator.wakeLock.request('screen');
      } catch {
        /* denied or unsupported (e.g. low battery) */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

export const haptic = {
  pot: () => navigator.vibrate?.(18),
  foul: () => navigator.vibrate?.([45, 40, 45]),
  tap: () => navigator.vibrate?.(8),
};

// ---- Hash router ----

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function go(path: string, replace = false) {
  const url = `#/${path.replace(/^\//, '')}`;
  if (replace) window.location.replace(url);
  else window.location.hash = url;
}
