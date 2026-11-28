import { render, screen } from '@testing-library/react';

import RoomInviteQr from '@/features/rooms/components/RoomInviteQr';

it('encodes the same game-specific invitation that players can open directly', () => {
  const previous = window.location.href;
  window.history.replaceState(null, '', '/games/quiz?spectate=ABCDE');
  try {
    render(<RoomInviteQr code='BCDEF' />);
    expect(
      screen.getByRole('link', { name: 'Buka undangan room BCDEF' }),
    ).toHaveAttribute(
      'href',
      `${window.location.origin}/games/quiz?room=BCDEF`,
    );
    expect(
      screen.getByRole('img', { name: 'Kode QR untuk room BCDEF' }),
    ).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml,/));
  } finally {
    window.history.replaceState(null, '', previous);
  }
});
