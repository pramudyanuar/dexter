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
 * Where the value lives:
 * - `local` is shared by every tab of this browser, and survives closing it.
 *   Right for records and preferences.
 * - `tab` belongs to this tab only (and survives a reload). Right for a game in
 *   progress or the room you are sitting in, so two tabs do not share one game.
 */
export type StoredScope = 'local' | 'tab';

const area = (scope: StoredScope) =>
  scope === 'tab' ? sessionStorage : localStorage;

/**
 * JSON state persisted in the browser. Renders `initial` on the server and
 * during hydration, then switches to the stored value without a mismatch.
 */
export default function useStoredState<T>(
  key: string,
  initial: T,
  scope: StoredScope = 'local',
) {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return area(scope).getItem(key);
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
        area(scope).setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable or full
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key, scope],
  );

  return [value, setValue] as const;
}
