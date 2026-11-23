'use client';

import useStoredState from '@/lib/useStoredState';

import SnakeShell from '@/components/games/snake/SnakeShell';
import SnakeSolo from '@/components/games/snake/SnakeSolo';
import SubmitScore from '@/components/games/SubmitScore';

export default function SnakePage() {
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
