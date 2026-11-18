'use client';

import useStoredState from '@/lib/useStoredState';

import GameShell from '@/components/games/GameShell';
import SnakeSolo from '@/components/games/snake/SnakeSolo';
import SubmitScore from '@/components/games/SubmitScore';

export default function SnakePage() {
  const [best, setBest] = useStoredState<number>('snake-best', 0);

  return (
    <GameShell name='snake' fit>
      <div className='mx-auto w-full max-w-md space-y-4 pb-3'>
        <h1 className='text-xl font-semibold'>Snake</h1>
        <SnakeSolo
          best={best}
          onBest={setBest}
          resultContent={(board) =>
            board.score > 0 && <SubmitScore game='snake' score={board.score} />
          }
        />
      </div>
    </GameShell>
  );
}
