import * as React from 'react';

/**
 * The scroll area a game lives in. The game is laid out at its natural size and
 * the page fills the screen; when a game (or a talkative phase of one) comes out
 * taller than the room there is, it scrolls instead of being shrunk down to an
 * unreadable size. A game that wants to fill the height sets its own `min-h`.
 */
export default function FitBox({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto'>
      <div className='flex flex-col'>{children}</div>
    </div>
  );
}
