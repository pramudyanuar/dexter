'use client';

import * as React from 'react';

import {
  evaluate,
  indonesianWords,
  keyboardStates,
  LetterState,
  loadWordList,
  MAX_GUESSES,
  WORD_LENGTH,
  WordleLang,
  WordList,
} from '@/lib/games/wordle';
import useStoredState from '@/lib/useStoredState';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import WordDefinition from '@/components/games/WordDefinition';

interface Game {
  answer: string;
  guesses: string[];
}

interface Stats {
  played: number;
  won: number;
  streak: number;
  best: number;
}

const NO_STATS: Stats = { played: 0, won: 0, streak: 0, best: 0 };
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const TILE: Record<LetterState, string> = {
  correct: 'bg-accent border-accent text-paper',
  present: 'bg-hash border-hash text-paper',
  absent: 'bg-line border-line text-[var(--mute)]',
};

const LANGS: { id: WordleLang; label: string }[] = [
  { id: 'id', label: 'Indonesia' },
  { id: 'en', label: 'English' },
];

function Wordle() {
  const [lang, setLang] = useStoredState<WordleLang>('wordle-lang', 'id');
  // each language has its own game in progress and its own record; Indonesian
  // keeps the original keys so nothing saved earlier is lost
  const suffix = lang === 'id' ? '' : `-${lang}`;
  const [game, setGame] = useStoredState<Game | null>(
    `wordle-game${suffix}`,
    null,
    'tab',
  );
  const [stats, setStats] = useStoredState<Stats>(
    `wordle-stats${suffix}`,
    NO_STATS,
  );
  // Indonesian words are bundled; English ones are fetched the first time
  const [lists, setLists] = React.useState<
    Partial<Record<WordleLang, WordList>>
  >({ id: indonesianWords });
  const words = lists[lang];
  React.useEffect(() => {
    if (lists[lang]) return;
    let cancelled = false;
    loadWordList(lang).then((list) => {
      if (!cancelled) setLists((prev) => ({ ...prev, [lang]: list }));
    });
    return () => {
      cancelled = true;
    };
  }, [lang, lists]);
  const [current, setCurrent] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [shake, setShake] = React.useState(0);

  const guesses = React.useMemo(() => game?.guesses ?? [], [game]);
  const answer = game?.answer ?? '';
  const won = guesses.includes(answer) && answer !== '';
  const lost = !won && guesses.length >= MAX_GUESSES;
  const over = won || lost;
  const letters = keyboardStates(guesses, answer);

  const flash = (text: string) => {
    setShake((n) => n + 1);
    setMessage(text);
    setTimeout(() => setMessage(''), 1600);
  };

  const submit = () => {
    if (over) return;
    if (current.length < WORD_LENGTH) return flash('Kurang huruf');
    if (!words) return flash('Memuat kamus…');
    if (!words.isValid(current)) return flash('Bukan kata dalam kamus');

    const secret = game?.answer ?? words.pick();
    const next = [...guesses, current];
    setGame({ answer: secret, guesses: next });
    setCurrent('');

    const isWin = current === secret;
    if (isWin || next.length >= MAX_GUESSES) {
      const streak = isWin ? stats.streak + 1 : 0;
      setStats({
        played: stats.played + 1,
        won: stats.won + (isWin ? 1 : 0),
        streak,
        best: Math.max(stats.best, streak),
      });
    }
  };

  const type = (letter: string) => {
    if (!over) setCurrent((c) => (c.length < WORD_LENGTH ? c + letter : c));
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') submit();
    else if (e.key === 'Backspace') setCurrent((c) => c.slice(0, -1));
    else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
  };

  // re-bound on each render so it always sees the current state
  React.useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => {
    if (i < guesses.length) {
      const states = evaluate(guesses[i], answer);
      return guesses[i].split('').map((ch, j) => ({ ch, state: states[j] }));
    }
    const typed = i === guesses.length ? current : '';
    return Array.from({ length: WORD_LENGTH }, (_, j) => ({
      ch: typed[j] ?? '',
      state: undefined,
    }));
  });

  const playAgain = () => {
    setGame(null);
    setCurrent('');
  };

  return (
    <>
      <div
        role='group'
        aria-label='Bahasa kata'
        className='mx-auto mb-4 flex w-fit gap-1 rounded-lg border border-line p-1'
      >
        {LANGS.map((l) => (
          <button
            key={l.id}
            type='button'
            aria-pressed={lang === l.id}
            onClick={() => {
              setLang(l.id);
              setCurrent('');
            }}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              lang === l.id
                ? 'bg-ink text-paper'
                : 'text-[var(--mute)] hover:text-ink'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div
        role='grid'
        aria-label='Papan tebakan'
        className='mx-auto grid w-full max-w-[18rem] gap-1.5'
      >
        {rows.map((row, i) => (
          <div
            key={i === guesses.length ? `typing-${shake}` : i}
            role='row'
            className={`grid grid-cols-5 gap-1.5 ${
              i === guesses.length && shake ? 'a-shake' : ''
            }`}
          >
            {row.map((tile, j) => (
              <div
                key={`${j}-${tile.ch}`}
                role='gridcell'
                data-state={tile.state ?? (tile.ch ? 'typing' : 'empty')}
                style={
                  tile.state && i === guesses.length - 1
                    ? { animationDelay: `${j * 0.15}s` }
                    : undefined
                }
                className={`flex aspect-square items-center justify-center rounded-md border-2 text-2xl font-bold uppercase transition-colors ${
                  tile.state
                    ? `${TILE[tile.state]} ${i === guesses.length - 1 ? 'a-flip' : ''}`
                    : tile.ch
                      ? 'a-pop border-ink/60'
                      : 'border-line'
                }`}
              >
                {tile.ch}
              </div>
            ))}
          </div>
        ))}
      </div>

      {won && <Confetti />}

      <div className='mt-4 min-h-12 text-center text-sm' aria-live='polite'>
        {won && (
          <p className='text-accent'>
            Benar! Selesai dalam {guesses.length} tebakan.
          </p>
        )}
        {lost && (
          <p className='text-err'>
            Kalah. Jawabannya{' '}
            <span className='font-bold uppercase'>{answer}</span>.
          </p>
        )}
        {!over && message && <p className='text-hash'>{message}</p>}
        {over && (
          <button
            type='button'
            onClick={playAgain}
            className='mt-1 text-info hover:underline'
          >
            main lagi
          </button>
        )}
      </div>

      {over && <WordDefinition word={answer} lang={lang} />}

      <div className='mt-auto space-y-1.5 pt-4'>
        {KEY_ROWS.map((row, r) => (
          <div key={row} className='flex justify-center gap-1'>
            {r === 2 && (
              <button
                type='button'
                onClick={submit}
                className='rounded-sm border border-line bg-card px-2 text-xs'
              >
                ↵
              </button>
            )}
            {row.split('').map((key) => (
              <button
                key={key}
                type='button'
                onClick={() => type(key)}
                className={`h-11 min-w-0 flex-1 rounded-md border text-sm uppercase transition-colors duration-300 active:scale-90 ${
                  letters[key] ? TILE[letters[key]] : 'border-line bg-card'
                }`}
              >
                {key}
              </button>
            ))}
            {r === 2 && (
              <button
                type='button'
                aria-label='Hapus'
                onClick={() => setCurrent((c) => c.slice(0, -1))}
                className='rounded-sm border border-line bg-card px-2 text-xs'
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      <p className='mt-4 text-center text-xs text-mute'>
        main {stats.played} · menang {stats.won} · beruntun {stats.streak} ·
        terbaik {stats.best}
      </p>
    </>
  );
}

export default function WordlePage() {
  return (
    <GameShell name='wordle'>
      <Wordle />
    </GameShell>
  );
}
