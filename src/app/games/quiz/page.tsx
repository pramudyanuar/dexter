'use client';

import * as React from 'react';

import { QuizView } from '@/lib/games/quiz';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import Countdown from '@/components/games/Countdown';
import GameShell from '@/components/games/GameShell';
import RoomGate, { Rematch, seatLabel } from '@/components/games/RoomGate';

const SECONDS = 15;
const LETTERS = ['A', 'B', 'C', 'D'];
const TONE = [
  'border-err/60 bg-err/10',
  'border-info/60 bg-info/10',
  'border-hash/60 bg-hash/10',
  'border-accent/60 bg-accent/10',
];

function Quiz() {
  const r = useRoom<QuizView>('quiz');

  return (
    <RoomGate
      r={r}
      blurb='# Kuis cepat untuk 2 sampai 6 pemain. 10 soal, jawab benar dan lebih cepat dari yang lain untuk dapat poin lebih banyak (3, 2, lalu 1).'
    >
      {({ room, you }) => {
        const v = room.state;
        const done = v.winners !== null;
        const answered = v.myAnswer !== null;
        const last = v.last;
        const ranking = v.scores
          .map((score, seat) => ({ score, seat }))
          .sort((a, b) => b.score - a.score);

        return (
          <>
            {done && v.winners!.includes(you) && <Confetti />}

            <ul
              className='mb-4 flex flex-wrap justify-center gap-2'
              aria-label='Skor'
            >
              {v.scores.map((score, seat) => (
                <li
                  key={seat}
                  data-seat={seat}
                  className={`rounded-md border px-3 py-1 text-center text-xs ${
                    seat === you ? 'border-accent' : 'border-line text-mute'
                  }`}
                >
                  <p>
                    {seatLabel(seat, you, room.names)}{' '}
                    {!done && v.answered[seat] && (
                      <span className='a-pop inline-block text-accent'>✓</span>
                    )}
                  </p>
                  <p key={score} className='a-pop text-base text-ink'>
                    {score}
                  </p>
                </li>
              ))}
            </ul>

            {last && (
              <div
                key={`last-${v.idx}`}
                className='a-slide-up mb-4 rounded-lg border border-line bg-card/60 p-3 text-xs'
                data-testid='last-result'
              >
                <p className='text-mute'>{last.q}</p>
                <p className='mt-1'>
                  Jawaban:{' '}
                  <b className='text-accent'>{last.options[last.correct]}</b>
                </p>
                <p className='mt-1 flex flex-wrap gap-x-3 text-mute'>
                  {last.gains.map((g, seat) => (
                    <span key={seat} className={g ? 'text-accent' : ''}>
                      {seatLabel(seat, you, room.names)}{' '}
                      {g
                        ? `+${g}`
                        : last.answers[seat] === -1
                          ? 'telat'
                          : 'salah'}
                    </span>
                  ))}
                </p>
              </div>
            )}

            {done ? (
              <div className='a-pop text-center'>
                <p className='mb-3 text-lg'>
                  {v.winners!.includes(you) ? (
                    <span className='text-accent'>
                      {v.winners!.length > 1
                        ? 'Kamu seri di puncak!'
                        : 'Kamu juara!'}
                    </span>
                  ) : (
                    <span className='text-err'>
                      {v
                        .winners!.map((w) => seatLabel(w, you, room.names))
                        .join(' & ')}{' '}
                      juara.
                    </span>
                  )}
                </p>
                <ol className='mx-auto max-w-xs divide-y divide-line border-y border-line text-sm'>
                  {ranking.map(({ seat, score }, i) => (
                    <li
                      key={seat}
                      className='a-slide-in flex justify-between py-1.5'
                      style={{ animationDelay: `${i * 120}ms` }}
                    >
                      <span>
                        {i + 1}. {seatLabel(seat, you, room.names)}
                      </span>
                      <span>{score}</span>
                    </li>
                  ))}
                </ol>
                <Rematch r={r} />
              </div>
            ) : (
              v.question && (
                <div key={v.idx} className='a-fade'>
                  <p className='mb-1 text-center text-xs text-mute'>
                    soal {v.idx + 1} dari {v.total}
                  </p>
                  <h2
                    className='mb-4 text-center text-lg leading-snug font-bold'
                    data-testid='question'
                  >
                    {v.question.q}
                  </h2>

                  {!answered ? (
                    <Countdown
                      key={v.idx}
                      className='mb-4'
                      seconds={SECONDS}
                      onExpire={() => r.move({ q: v.idx, choice: -1 })}
                    />
                  ) : (
                    <p className='a-bob mb-4 text-center text-xs text-mute'>
                      Jawabanmu terkunci. Menunggu pemain lain…
                    </p>
                  )}

                  <div className='grid gap-2 sm:grid-cols-2'>
                    {v.question.options.map((opt, i) => (
                      <button
                        key={i}
                        type='button'
                        data-option={i}
                        aria-pressed={v.myAnswer === i}
                        disabled={answered || r.busy}
                        onClick={() => r.move({ q: v.idx, choice: i })}
                        style={{ animationDelay: `${i * 70}ms` }}
                        className={`a-slide-up flex items-center gap-3 rounded-lg border-2 px-3 py-3 text-left transition-all duration-200 ${
                          TONE[i]
                        } ${
                          v.myAnswer === i
                            ? 'scale-[1.02] ring-2 ring-ink'
                            : answered
                              ? 'opacity-40'
                              : 'enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:active:scale-95'
                        }`}
                      >
                        <span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-paper/80 text-xs font-bold'>
                          {LETTERS[i]}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              Waktu 15 detik per soal. Tidak menjawab berarti 0 poin. Room
              hilang sendiri setelah 2 jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function QuizPage() {
  const mounted = useMounted();

  return (
    <GameShell name='kuis' wide>
      {mounted ? <Quiz /> : null}
    </GameShell>
  );
}
