import { render, screen } from '@testing-library/react';

import {
  createInitialMatch,
  PITCH,
  stepSoccer,
} from '@/features/pixel-soccer/game';
import PixelSoccerHost from '@/features/pixel-soccer/PixelSoccerHost';
import { EMPTY_INPUT } from '@/features/tv-controller/protocol';

jest.mock('@/integrations/supabase/config', () => ({
  getSupabasePublicConfig: () => null,
}));

describe('pixel-soccer engine', () => {
  it('moves player and kicks the ball when A is pressed near the ball', () => {
    const state = createInitialMatch([
      { slot: 0, team: 'red', name: 'P1', isBot: false },
      { slot: 1, team: 'blue', name: 'Bot', isBot: true },
    ]);
    state.players[0].x = state.ball.x - 10;
    state.players[0].y = state.ball.y;

    const next = stepSoccer(state, { 0: { ...EMPTY_INPUT, a: true } }, 0.03);
    expect(next.ball.vx).toBeGreaterThan(100);
  });

  it('lets the ball cross the goal line unobstructed inside the goal mouth', () => {
    const state = createInitialMatch([
      { slot: 0, team: 'red', name: 'P1', isBot: false },
      { slot: 1, team: 'blue', name: 'Bot', isBot: true },
    ]);
    state.ball.x = PITCH.right - 2;
    state.ball.vx = 250;
    state.ball.y = (PITCH.goalTop + PITCH.goalBottom) / 2;

    const step1 = stepSoccer(state, {}, 0.02);
    expect(step1.ball.vx).toBeGreaterThan(0);
    const step2 = stepSoccer(step1, {}, 0.02);
    expect(step2.scoreRed).toBe(1);
  });

  it('unstucks a bot when the ball is pinned in a corner', () => {
    const state = createInitialMatch([
      { slot: 0, team: 'red', name: 'P1', isBot: false },
      { slot: 1, team: 'blue', name: 'Bot', isBot: true },
    ]);
    state.ball.x = PITCH.left + 4;
    state.ball.y = PITCH.top + 4;
    state.players[1].x = PITCH.left + 10;
    state.players[1].y = PITCH.top + 10;

    const next = stepSoccer(state, {}, 0.03);
    expect(next.ball.vx).toBeGreaterThan(0);
    expect(next.ball.vy).toBeGreaterThan(0);
  });

  it('awards a goal to Red when the ball enters the right goal mouth', () => {
    const state = createInitialMatch([
      { slot: 0, team: 'red', name: 'P1', isBot: false },
      { slot: 1, team: 'blue', name: 'Bot', isBot: true },
    ]);
    state.ball.x = PITCH.right + 6;
    state.ball.y = (PITCH.goalTop + PITCH.goalBottom) / 2;

    const next = stepSoccer(state, {}, 0.03);
    expect(next.scoreRed).toBe(1);
    expect(next.goalBannerTimer).toBeGreaterThan(0);
  });
});

describe('PixelSoccerHost', () => {
  it('renders lobby with QR invite, 1v1/2v2 switch, and 1/2 screen modes', () => {
    render(<PixelSoccerHost />);
    expect(
      screen.getByRole('heading', { name: 'Bola Pixel' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1V1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2V2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 Layar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 Layar' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Mulai Pertandingan/i }),
    ).toBeInTheDocument();
  });
});
