'use client';

import * as React from 'react';

/** Puts the game's name in the browser tab: "Mahjong · Dexter". */
export default function DocumentTitle({ title }: { title: string }) {
  React.useEffect(() => {
    const before = document.title;
    document.title = `${title} · Dexter`;
    return () => {
      document.title = before;
    };
  }, [title]);
  return null;
}
