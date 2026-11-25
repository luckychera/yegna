import { useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query. Falls back to `fallback` where matchMedia does not exist (SSR, tests). */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => {};

      const list = window.matchMedia(query);

      list.addEventListener('change', notify);

      return () => list.removeEventListener('change', notify);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}
