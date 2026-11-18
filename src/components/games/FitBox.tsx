'use client';

import * as React from 'react';

/**
 * Responsive layout wrapper for game content.
 * Previously applied CSS `zoom` to force-fit tall content into a single screen,
 * which caused text and controls to shrink unreadably as dynamic content grew.
 * Now preserves native 100% scale and lets the full-screen viewport scroll naturally.
 */
export default function FitBox({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex w-full flex-1 flex-col overflow-x-hidden'>
      <div className='flex w-full flex-col'>{children}</div>
    </div>
  );
}
