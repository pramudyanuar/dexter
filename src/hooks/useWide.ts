import * as React from 'react';

const QUERY = '(min-width: 1280px)';

const subscribe = (notify: () => void) => {
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener('change', notify);
  return () => mq?.removeEventListener('change', notify);
};

/** Whether the screen is wide enough for the side panels (false on the server). */
export default function useWide() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  );
}
