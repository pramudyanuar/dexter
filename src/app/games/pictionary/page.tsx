'use client';

import { Check, Pencil } from 'lucide-react';
import * as React from 'react';

import styles from '@/app/games/pictionary/pictionary.module.css';

import useMounted from '@/hooks/useMounted';

import DrawingBoard from '@/app/games/pictionary/DrawingBoard';
import Confetti from '@/features/games/components/Confetti';
import { useRemainingMs } from '@/features/games/components/Countdown';
import GameShell from '@/features/games/components/GameShell';
import { PictionaryView } from '@/features/games/logic/pictionary';
import RoomChat from '@/features/rooms/components/RoomChat';
import RoomGate, {
  Rematch,
  seatLabel,
  seatTitle,
} from '@/features/rooms/components/RoomGate';
import { useRoom } from '@/features/rooms/useRoom';

type GameRoom = ReturnType<typeof useRoom<PictionaryView>>;

function RoundHeader({
  v,
  you,
  r,
}: {
  v: PictionaryView;
  you: number;
  r: GameRoom;
}) {
  const seconds = Math.min(
    v.roundSeconds,
    r.room?.waiting?.seconds ?? Infinity,
  );
  const deadline =
    r.receivedAt +
    Math.min(v.remainingMs, (r.room?.waiting?.remaining ?? Infinity) * 1000);
  const leftMs = useRemainingMs(deadline);
  const left = Math.ceil(leftMs / 1000);
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const isDrawer = v.drawer === you;
  const choices = isDrawer && v.strokes.length === 0 ? v.choices : null;

  return (
    <header className={styles.roundHeader} data-drawer={isDrawer}>
      <div className={styles.prompt}>
        <p className={styles.round}>
          Ronde {v.round + 1} / {v.rounds}
        </p>
        {choices ? (
          <>
            <p className={styles.caption}>Pilih kata untuk digambar</p>
            <div
              className={styles.choices}
              role='group'
              aria-label='Pilihan kata'
            >
              {choices.map((word) => (
                <button
                  key={word}
                  type='button'
                  aria-pressed={v.word === word}
                  onClick={() => r.move({ type: 'pick_word', word })}
                >
                  {word}
                </button>
              ))}
              <span hidden data-testid='word'>
                {v.word}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className={styles.caption}>
              {isDrawer
                ? 'Gambarmu'
                : `${seatLabel(v.drawer, you, r.room?.names)} sedang menggambar`}
            </p>
            <p
              className={isDrawer ? styles.word : styles.hint}
              data-testid={isDrawer ? 'word' : 'hint'}
            >
              {isDrawer ? v.word : v.hint}
            </p>
          </>
        )}
      </div>
      <div
        className={styles.timer}
        data-urgent={left <= 3}
        data-testid='countdown'
      >
        <span className={styles.caption}>Sisa waktu</span>
        <span role='timer' aria-label={`${left} detik tersisa`}>
          {clock}
        </span>
      </div>
      <div className={styles.timerTrack} aria-hidden='true'>
        <div
          data-urgent={left <= 3}
          style={{ width: `${Math.min(100, leftMs / (seconds * 10))}%` }}
        />
      </div>
    </header>
  );
}

function PlayerScores({
  v,
  you,
  names,
}: {
  v: PictionaryView;
  you: number;
  names: (string | null)[] | undefined;
}) {
  return (
    <section
      className={`${styles.players} ${styles.panel}`}
      aria-labelledby='pictionary-players'
    >
      <div className={styles.panelHead}>
        <h2 id='pictionary-players'>Pemain</h2>
        <span>Poin</span>
      </div>
      <ul aria-label='Skor pemain' className={styles.scoreList}>
        {v.scores.map((score, seat) => {
          const label = seatTitle(seat, you, names);
          const drawing = seat === v.drawer;
          const solved = v.solved.includes(seat);
          return (
            <li key={seat} data-seat={seat} data-drawing={drawing}>
              <span className={styles.initial} aria-hidden='true'>
                {label.slice(0, 1).toUpperCase()}
              </span>
              <div className={styles.playerName}>
                <p>{label}</p>
                {(drawing || solved) && (
                  <span className={styles.playerState} data-solved={solved}>
                    {drawing ? (
                      <Pencil size={12} aria-hidden='true' />
                    ) : (
                      <Check size={12} aria-hidden='true' />
                    )}
                    {drawing ? 'Menggambar' : 'Benar'}
                  </span>
                )}
              </div>
              <strong className={styles.score}>{score}</strong>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GuessPanel({
  v,
  you,
  r,
}: {
  v: PictionaryView;
  you: number;
  r: GameRoom;
}) {
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const log = React.useRef<HTMLUListElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const isDrawer = v.drawer === you;
  const solvedMe = v.solved.includes(you);
  const latest = v.guesses.at(-1);

  React.useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [v.round, v.guesses.length, latest?.text, latest?.seat]);

  return (
    <section className={styles.guesses} aria-labelledby='pictionary-guesses'>
      <div className={styles.panelHead}>
        <h2 id='pictionary-guesses'>
          {isDrawer || solvedMe ? (
            'Tebakan'
          ) : (
            <label htmlFor='pictionary-guess'>Tebakan</label>
          )}
        </h2>
      </div>
      <ul
        ref={log}
        className={styles.feed}
        role='log'
        aria-label='Riwayat tebakan'
        data-testid='guesses'
      >
        {!v.guesses.length && (
          <li className={styles.caption}>Belum ada tebakan.</li>
        )}
        {v.guesses.slice(-16).map((g, i) => (
          <li key={`${i}-${g.seat}-${g.text}`}>
            {g.correct ? (
              <span className={styles.solved}>
                <Check size={16} aria-hidden='true' />{' '}
                {seatLabel(g.seat, you, r.room?.names)} menebak dengan benar!
              </span>
            ) : (
              <>
                <span className={styles.caption}>
                  {seatLabel(g.seat, you, r.room?.names)}
                  {' · '}
                </span>
                {g.text}
                {g.seat === you && (
                  <span className={styles.caption}> · Belum tepat</span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p
          id='pictionary-guess-error'
          role='alert'
          className={styles.inputError}
        >
          {error} Coba kirim lagi.
        </p>
      )}
      {isDrawer ? (
        <p className={styles.guessState}>Pemain lain menebak gambarmu.</p>
      ) : solvedMe ? (
        <p role='status' className={`${styles.guessState} ${styles.solved}`}>
          <Check size={16} aria-hidden='true' /> Tebakanmu benar!
        </p>
      ) : (
        <form
          className={styles.guessForm}
          aria-busy={sending}
          onSubmit={async (e) => {
            e.preventDefault();
            const guess = text.trim();
            if (!guess || sending) return;
            input.current?.focus({ preventScroll: true });
            setSending(true);
            setError('');
            try {
              await r.moveOrThrow(
                { type: 'guess', text: guess, round: v.round },
                AbortSignal.timeout(8000),
              );
              setText((current) => (current === text ? '' : current));
            } catch (error) {
              setError(
                error instanceof Error && error.name !== 'TimeoutError'
                  ? error.message
                  : 'Tebakan gagal dikirim.',
              );
            } finally {
              setSending(false);
            }
          }}
        >
          <input
            ref={input}
            id='pictionary-guess'
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            placeholder='Tulis tebakan'
            maxLength={40}
            autoComplete='off'
            autoCorrect='off'
            enterKeyHint='send'
            spellCheck={false}
            aria-describedby={error ? 'pictionary-guess-error' : undefined}
          />
          <button type='submit' disabled={sending || !text.trim()}>
            {sending ? 'Mengirim…' : 'Tebak'}
          </button>
        </form>
      )}
    </section>
  );
}

function PlayArea({
  v,
  you,
  r,
}: {
  v: PictionaryView;
  you: number;
  r: GameRoom;
}) {
  const isDrawer = v.drawer === you;

  if (v.winners) {
    const ranking = v.scores
      .map((score, seat) => ({ score, seat }))
      .sort((a, b) => b.score - a.score);
    const won = v.winners.includes(you);
    return (
      <section className={styles.results} aria-labelledby='pictionary-results'>
        {won && <Confetti />}
        <p className={styles.round}>Hasil akhir</p>
        <h2 id='pictionary-results'>
          {won
            ? v.winners.length > 1
              ? 'Kamu seri di puncak!'
              : 'Kamu juara!'
            : `${v.winners.map((seat) => seatLabel(seat, you, r.room?.names)).join(' & ')} juara.`}
        </h2>
        {v.last && (
          <p className={styles.caption}>Kata terakhir · {v.last.word}</p>
        )}
        <ol className={styles.rankList}>
          {ranking.map(({ seat, score }, i) => (
            <li key={seat}>
              <span>
                {i + 1}. {seatTitle(seat, you, r.room?.names)}
              </span>
              <strong>{score}</strong>
            </li>
          ))}
        </ol>
        <Rematch r={r} />
      </section>
    );
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.stage} aria-label='Ronde permainan'>
        <RoundHeader v={v} you={you} r={r} />
        <DrawingBoard
          key={v.round}
          strokes={v.strokes}
          canDraw={isDrawer}
          canRedo={v.canRedo}
          onMove={(move, signal) =>
            r.moveOrThrow({ ...move, round: v.round }, signal)
          }
        />
        {v.last && (
          <p className={styles.lastWord}>
            Kata sebelumnya · <strong>{v.last.word}</strong>
          </p>
        )}
      </section>

      <GuessPanel key={v.round} v={v} you={you} r={r} />
      <div className={styles.chat}>
        <RoomChat game='pictionary' names={r.room?.names} inline />
      </div>
      <PlayerScores v={v} you={you} names={r.room?.names} />
    </div>
  );
}

function Pictionary() {
  const r = useRoom<PictionaryView>('pictionary');

  return (
    <RoomGate
      r={r}
      inlineNotice
      blurb='Bergantian menggambar kata rahasia. Tebak lebih cepat untuk mendapat lebih banyak poin.'
    >
      {({ room, you }) => <PlayArea v={room.state} you={you} r={r} />}
    </RoomGate>
  );
}

export default function PictionaryPage() {
  const mounted = useMounted();

  return (
    <GameShell name='pictionary' fit className={styles.shell}>
      {mounted ? <Pictionary /> : null}
    </GameShell>
  );
}
