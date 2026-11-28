import * as React from 'react';

const subscribe = () => () => {};

/** False while rendering on the server and during hydration, true after. */
export default function useMounted() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
