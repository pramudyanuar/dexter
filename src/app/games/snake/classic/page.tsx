'use client';

import useStoredState from '@/hooks/useStoredState';

import SnakeShell from '@/features/games/components/snake/SnakeShell';
import SnakeSolo from '@/features/games/components/snake/SnakeSolo';
import SubmitScore from '@/features/leaderboard/components/SubmitScore';

export default function SnakeClassicPage() {
  const [best, setBest] = useStoredState<number>('snake-best', 0);

  return (
    <SnakeShell mode='classic'>
      <SnakeSolo
        best={best}
        onBest={setBest}
        resultContent={(board, moves, seed) =>
          board.score > 0 && (
            <SubmitScore
              game='snake'
              score={board.score}
              replay={{ seed, moves }}
            />
          )
        }
      />
    </SnakeShell>
  );
}
