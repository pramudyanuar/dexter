import { render, screen } from '@testing-library/react';

import {
  createInitialSumo,
  CX,
  CY,
  START_RADIUS,
  stepSumo,
} from '@/features/sumo-arena/game';
import SumoHost from '@/features/sumo-arena/SumoHost';
import { EMPTY_INPUT } from '@/features/tv-controller/protocol';

jest.mock('@/integrations/supabase/config', () => ({
  getSupabasePublicConfig: () => null,
}));

describe('sumo-arena engine', () => {
  it('pushes opponent back when charging with A', () => {
    const state = createInitialSumo([
      { slot: 0, name: 'P1', isBot: false },
      { slot: 1, name: 'P2', isBot: false },
    ]);
    state.fighters[0].x = CX - 6;
    state.fighters[0].y = CY;
    state.fighters[0].dirX = 1;
    state.fighters[1].x = CX + 6;
    state.fighters[1].y = CY;

    const next = stepSumo(
      state,
      { 0: { ...EMPTY_INPUT, a: true, right: true } },
      0.03,
    );
    expect(next.fighters[1].vx).toBeGreaterThan(50);
  });

  it('eliminates a fighter outside the ring and awards round point', () => {
    const state = createInitialSumo([
      { slot: 0, name: 'P1', isBot: false },
      { slot: 1, name: 'Bot', isBot: true },
    ]);
    state.fighters[1].x = CX + START_RADIUS + 10;
    state.fighters[1].y = CY;

    const next = stepSumo(state, {}, 0.03);
    expect(next.fighters[1].alive).toBe(false);
    expect(next.fighters[0].score).toBe(1);
    expect(next.roundOverTimer).toBeGreaterThan(0);
  });
});

describe('SumoHost', () => {
  it('renders lobby with QR invite and player count toggle', () => {
    render(<SumoHost />);
    expect(
      screen.getByRole('heading', { name: 'Sumo Bumper Arena' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '2 Pemain' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '4 Pemain' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Mulai Pertarungan/i }),
    ).toBeInTheDocument();
  });
});
