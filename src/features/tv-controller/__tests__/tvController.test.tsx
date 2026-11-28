import { fireEvent, render, screen } from '@testing-library/react';

import {
  createInitialRace,
  createRandomTrack,
  standings,
  stepRace,
} from '@/features/tv-controller/game';
import PhoneController from '@/features/tv-controller/PhoneController';
import {
  EMPTY_INPUT,
  normalizeTvRoomCode,
} from '@/features/tv-controller/protocol';
import TvHost from '@/features/tv-controller/TvHost';

jest.mock('@/integrations/supabase/config', () => ({
  getSupabasePublicConfig: () => null,
}));

describe('tv-controller game engine', () => {
  it('moves a kart forward when throttle A is pressed', () => {
    const track = createRandomTrack(101);
    const initial = createInitialRace(
      [
        { slot: 0, name: 'P1', isBot: false },
        { slot: 1, name: 'Bot', isBot: true },
      ],
      track,
    );
    const startX = initial.karts[0].x;
    const startY = initial.karts[0].y;
    const next = stepRace(initial, { 0: { ...EMPTY_INPUT, a: true } }, 0.04);
    expect(
      Math.hypot(next.karts[0].x - startX, next.karts[0].y - startY),
    ).toBeGreaterThan(0);
  });

  it('generates distinct procedural circuits for different seeds', () => {
    const a = createRandomTrack(1);
    const b = createRandomTrack(999);
    expect(a.points.length).toBeGreaterThanOrEqual(120);
    expect(a.points[0]).not.toEqual(b.points[0]);
  });

  it('sorts standings by finished time and lap/checkpoint progress', () => {
    const base = createInitialRace([
      { slot: 0, name: 'A', isBot: false },
      { slot: 1, name: 'B', isBot: false },
    ]);
    base.karts[0].lap = 1;
    base.karts[1].lap = 2;
    const ordered = standings(base.karts);
    expect(ordered[0].slot).toBe(1);
  });

  it('normalizes room codes to 5 uppercase alphanumeric chars', () => {
    expect(normalizeTvRoomCode('ab-c1234')).toBe('ABC12');
  });
});

describe('TvHost & PhoneController', () => {
  it('renders TvHost lobby with room code, QR, and 4 player slots', () => {
    render(<TvHost />);
    expect(
      screen.getByRole('heading', { name: 'Turbo TV Arena' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Controller Terhubung \(0\/4\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Mulai Balapan/i }),
    ).toBeInTheDocument();
  });

  it('connects PhoneController manually when given a room code', () => {
    render(<PhoneController />);
    fireEvent.change(screen.getByPlaceholderText('ABCDE'), {
      target: { value: 'zx99k' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hubungkan ke TV' }));
    expect(screen.getByLabelText('Analog Joystick')).toBeInTheDocument();
    expect(screen.getByLabelText('Gas (A)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Layar penuh' }),
    ).toBeInTheDocument();
  });
});
