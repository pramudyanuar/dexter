import * as React from 'react';

const EVENT = 'stored-state-change';

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * JSON state persisted in localStorage. Renders `initial` on the server and
 * during hydration, then switches to the stored value without a mismatch.
 */
export default function useStoredState<T>(key: string, initial: T) {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const value = React.useMemo<T>(() => {
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
    // `initial` is a constant default
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = React.useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable or full
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, setValue] as const;
}
