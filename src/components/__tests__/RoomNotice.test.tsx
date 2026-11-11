import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { RoomView } from '@/lib/rooms/types';

import RoomNotice from '@/components/games/RoomNotice';

const base: RoomView = {
  code: 'ABCDE',
  game: 'uno',
  status: 'playing',
  seat: 0,
  joined: [true, true, true],
  names: [null, 'Budi', null],
  capacity: 8,
  minPlayers: 2,
  version: 3,
  state: {},
  out: [false, false, false],
  outWhy: [null, null, null],
  strikes: [0, 0, 0],
  maxStrikes: 3,
  host: 1,
  hostNotice: 0,
  leaving: [],
  waiting: null,
};

const show = (
  room: Partial<RoomView>,
  extra: { onKick?: (seat: number) => void; you?: number } = {},
) =>
  render(
    <RoomNotice
      room={{ ...base, ...room }}
      you={extra.you ?? 0}
      receivedAt={Date.now()}
      onKick={extra.onKick}
    />,
  );

describe('RoomNotice', () => {
  it('says nothing when everything is fine', () => {
    const { container } = show({});
    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing in the waiting room', () => {
    const { container } = show({
      status: 'waiting',
      waiting: { seats: [0], remaining: 5, seconds: 40 },
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('warns that a player pressed keluar, using their name and the seconds they have', () => {
    show({ leaving: [{ seat: 1, goneIn: 8 }] });
    expect(
      screen.getByText(
        /Budi keluar\. Dikeluarkan dari permainan dalam \d+ detik kalau tidak kembali/,
      ),
    ).toBeInTheDocument();
  });

  it('does not warn about yourself', () => {
    show({ leaving: [{ seat: 0, goneIn: 8 }] });
    expect(screen.queryByText(/keluar\. Dikeluarkan/)).not.toBeInTheDocument();
  });

  it('says why someone is out: left, idle, or removed by the admin', () => {
    show({
      status: 'over',
      joined: [true, true, true, true],
      names: [null, 'Budi', 'Sari', 'Dewi'],
      out: [false, true, true, true],
      outWhy: [null, 'left', 'idle', 'kicked'],
    });
    expect(screen.getByText('Budi keluar dari permainan.')).toBeInTheDocument();
    expect(
      screen.getByText('Sari dikeluarkan karena terlalu lama tidak bergerak.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Dewi dikeluarkan admin.')).toBeInTheDocument();
  });

  it('tells a removed player the reason, and stops the clock for them', () => {
    show({
      out: [true, false, false],
      outWhy: ['kicked', null, null],
      strikes: [3, 0, 0],
      waiting: { seats: [0], remaining: 10, seconds: 40 },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Kamu dikeluarkan dari permainan oleh admin.',
    );
    expect(screen.queryByTestId('turn-clock')).not.toBeInTheDocument();
  });

  it('announces a new admin for a few seconds', () => {
    show({ host: 1, hostNotice: 8 });
    expect(screen.getByText('Budi sekarang admin room.')).toBeInTheDocument();
  });

  it('tells you when you are the new admin', () => {
    show({ host: 0, hostNotice: 8 }, { onKick: jest.fn() });
    expect(screen.getByText('Kamu sekarang admin room.')).toBeInTheDocument();
  });

  it('counts down your turn and turns urgent near the end', () => {
    show({ waiting: { seats: [0], remaining: 8, seconds: 40 } });
    expect(screen.getByText(/Giliranmu habis dalam \d+ detik/)).toHaveClass(
      'text-err',
    );
  });

  it('shows whose turn is running out when it is someone else', () => {
    show({ waiting: { seats: [1], remaining: 30, seconds: 40 } });
    expect(screen.getByText(/Menunggu Budi: \d+ detik/)).toBeInTheDocument();
  });

  it('warns about missed turns, with how many are left', () => {
    show({ strikes: [2, 0, 0] });
    expect(screen.getByText(/Peringatan 2\/3/)).toBeInTheDocument();
  });

  describe('pop-ups', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('shows the missed-turn warning as a pop-up that closes by itself', () => {
      show({ strikes: [1, 0, 0] });
      expect(screen.getByRole('status')).toHaveTextContent(/Peringatan 1\/3/);
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(screen.queryByText(/Peringatan 1\/3/)).not.toBeInTheDocument();
    });

    it('can be closed by hand', () => {
      show({ strikes: [1, 0, 0] });
      fireEvent.click(screen.getByRole('button', { name: 'Tutup' }));
      expect(screen.queryByText(/Peringatan/)).not.toBeInTheDocument();
    });

    it('keeps the notice that you were removed up', () => {
      show({ out: [true, false, false], outWhy: ['idle', null, null] });
      act(() => {
        jest.advanceTimersByTime(60000);
      });
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('the admin panel', () => {
    it('is only for the admin', () => {
      show({ host: 1 }, { onKick: jest.fn() });
      expect(screen.queryByText('Kelola pemain')).not.toBeInTheDocument();
    });

    it('lets the admin remove a player in the middle of a game, after asking once more', () => {
      const onKick = jest.fn();
      show({ host: 0 }, { onKick });
      // a gear in the top bar, closed until pressed
      expect(screen.queryByText('Kamu admin room ini')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Kelola pemain' }));
      expect(screen.getByText('Kamu admin room ini')).toBeInTheDocument();

      // each other player in the game, but not yourself
      const rows = screen.getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(screen.getByText('Budi')).toBeInTheDocument();

      const budi = () => screen.getAllByRole('listitem')[0];
      fireEvent.click(
        within(budi()).getByRole('button', { name: 'Keluarkan' }),
      );
      // nothing happens on the first click
      expect(onKick).not.toHaveBeenCalled();
      expect(screen.getByText('Yakin?')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
      expect(screen.queryByText('Yakin?')).not.toBeInTheDocument();

      fireEvent.click(
        within(budi()).getByRole('button', { name: 'Keluarkan' }),
      );
      fireEvent.click(
        within(budi()).getByRole('button', { name: 'Keluarkan' }),
      );
      expect(onKick).toHaveBeenCalledWith(1);
    });

    it('keeps the room code and the way out with the admin tools', () => {
      const onLeave = jest.fn();
      render(
        <RoomNotice
          room={{ ...base, host: 0 }}
          you={0}
          receivedAt={Date.now()}
          onKick={jest.fn()}
          code='ABCDE'
          onLeave={onLeave}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Kelola pemain' }));
      expect(screen.getByText('ABCDE')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Keluar' }));
      expect(onLeave).toHaveBeenCalled();
    });

    it('does not offer players who are already out', () => {
      show({ host: 0, out: [false, true, false] }, { onKick: jest.fn() });
      fireEvent.click(screen.getByRole('button', { name: 'Kelola pemain' }));
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
  });
});
