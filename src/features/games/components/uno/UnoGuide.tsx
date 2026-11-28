'use client';

import * as React from 'react';

import { Side, UnoCard } from '@/features/games/components/uno/UnoCard';
import type { Card } from '@/features/games/logic/uno';

type Kind = 'uno' | 'unoflip' | 'unomercy';

interface Entry {
  card: string;
  name: string;
  does: string;
}
interface Section {
  title: string;
  side?: Side;
  cards: Entry[];
}

const c = (code: string): Card => ({
  c: code[0] as Card['c'],
  v: code.slice(1) as Card['v'],
});

const basics = (mercyLimit: number): Record<Kind, string[]> => ({
  uno: [
    'Play a card that matches the colour or the number/symbol of the top card. First to empty their hand wins; the rest play on for 2nd, 3rd…',
    'Nothing fits? Draw one. If the drawn card fits you may play it, or pass.',
    'Same numbers can go down together: tap a number, pick the others, the last one sets the colour.',
    'On your second-to-last card, call UNO (button, or the U key). Forget it and anyone can catch you: you draw 2.',
    'Tap or drag a card onto the pile to play it.',
  ],
  unoflip: [
    'Every card has two faces. The game starts on the light side; a FLIP card turns the pile and every hand over to the dark side (and back).',
    'You hold the side in play. Everyone else sees the other side of your cards, and you see theirs: tap a player to look closer, or use "see dark side" for your own.',
    'Match colour or number/symbol. Nothing fits? Draw one; play it if it fits, or pass.',
    'Call UNO on your second-to-last card, or get caught and draw 2.',
  ],
  unomercy: [
    'Match colour or number/symbol. Nothing fits? You keep drawing until a card does.',
    'Draw cards stack: answer a +2/+4/+6/+10 with any other draw card and the total moves on. Whoever cannot answer takes the whole stack and loses the turn.',
    `Reach ${mercyLimit} cards and you are out of the game. No mercy.`,
    'Call UNO on your second-to-last card, or get caught and draw 2.',
  ],
});

const CARDS: Record<Kind, Section[]> = {
  uno: [
    {
      title: 'Action cards',
      cards: [
        { card: 'RS', name: 'Skip', does: 'The next player loses their turn.' },
        {
          card: 'YV',
          name: 'Reverse',
          does: 'Play goes the other way. With two players it works as a skip.',
        },
        {
          card: 'GD',
          name: 'Draw Two',
          does: 'The next player draws 2 and loses their turn.',
        },
        {
          card: 'WW',
          name: 'Wild',
          does: 'Play it on anything and pick the colour.',
        },
        {
          card: 'WF',
          name: 'Wild Draw Four',
          does: 'Pick the colour; the next player draws 4. They may challenge instead: if you were holding the colour that was in play, you draw the 4. If you were not, they draw 6.',
        },
      ],
    },
  ],
  unoflip: [
    {
      title: 'Light side',
      side: 'light',
      cards: [
        {
          card: 'RD1',
          name: 'Draw One',
          does: 'The next player draws 1 and loses their turn.',
        },
        { card: 'BS', name: 'Skip', does: 'The next player loses their turn.' },
        { card: 'GV', name: 'Reverse', does: 'Play goes the other way.' },
        {
          card: 'YL',
          name: 'Flip',
          does: 'Everything turns over to the dark side.',
        },
        { card: 'WW', name: 'Wild', does: 'Pick the colour.' },
        {
          card: 'WWD2',
          name: 'Wild Draw Two',
          does: 'Pick the colour; the next player draws 2 and loses their turn.',
        },
      ],
    },
    {
      title: 'Dark side',
      side: 'dark',
      cards: [
        {
          card: 'OD5',
          name: 'Draw Five',
          does: 'The next player draws 5 and loses their turn.',
        },
        {
          card: 'TSE',
          name: 'Skip Everyone',
          does: 'Everybody is skipped: you play again.',
        },
        { card: 'UV', name: 'Reverse', does: 'Play goes the other way.' },
        {
          card: 'PL',
          name: 'Flip',
          does: 'Everything turns back to the light side.',
        },
        { card: 'WW', name: 'Wild', does: 'Pick the colour.' },
        {
          card: 'WWDC',
          name: 'Wild Draw Colour',
          does: 'Pick a colour; the next player keeps drawing until they get that colour, then loses their turn.',
        },
      ],
    },
  ],
  unomercy: [
    {
      title: 'Draw cards (they stack)',
      cards: [
        { card: 'RD', name: 'Draw Two', does: 'Adds 2 to the stack.' },
        { card: 'BD4', name: 'Draw Four', does: 'Adds 4 to the stack.' },
        {
          card: 'WWR4',
          name: 'Wild Reverse Draw Four',
          does: 'Reverses play, adds 4 to the stack, and you pick the colour.',
        },
        {
          card: 'WW6',
          name: 'Wild Draw Six',
          does: 'Adds 6 to the stack; pick the colour.',
        },
        {
          card: 'WW10',
          name: 'Wild Draw Ten',
          does: 'Adds 10 to the stack; pick the colour.',
        },
      ],
    },
    {
      title: 'Action cards',
      cards: [
        { card: 'GS', name: 'Skip', does: 'The next player loses their turn.' },
        {
          card: 'YSE',
          name: 'Skip Everyone',
          does: 'Everybody is skipped: you play again.',
        },
        { card: 'RV', name: 'Reverse', does: 'Play goes the other way.' },
        {
          card: 'BDA',
          name: 'Discard All',
          does: 'Every other card of that colour in your hand goes down with it.',
        },
        {
          card: 'G7',
          name: 'Seven: swap',
          does: 'Swap your whole hand with a player you choose.',
        },
        {
          card: 'Y0',
          name: 'Zero: pass it on',
          does: 'Everyone hands their cards to the next player in the direction of play.',
        },
        {
          card: 'WWRL',
          name: 'Wild Colour Roulette',
          does: 'Pick a colour; the next player keeps drawing until they get that colour, then loses their turn.',
        },
      ],
    },
  ],
};

const TITLE: Record<Kind, string> = {
  uno: 'How to play Uno',
  unoflip: 'How to play Uno Flip',
  unomercy: 'How to play Uno No Mercy',
};

/** The rules and what every special card does, for the Uno being played. */
export default function UnoGuide({
  game,
  mercyLimit,
  turnSeconds,
  onClose,
}: {
  game: Kind;
  mercyLimit: number;
  turnSeconds?: number;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div
      className='a-fade fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3'
      onClick={onClose}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-label={TITLE[game]}
        className='a-pop flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line-strong bg-card shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 border-b border-line px-4 py-3'>
          <h2 className='font-semibold'>{TITLE[game]}</h2>
          <button
            type='button'
            onClick={onClose}
            className='uno-btn uno-btn-quiet'
          >
            Close
          </button>
        </div>
        <div className='space-y-4 overflow-y-auto px-4 py-3 text-sm'>
          <ul className='list-disc space-y-1.5 pl-5 text-ink/90'>
            {basics(mercyLimit)[game].map((line) => (
              <li key={line}>{line}</li>
            ))}
            {turnSeconds !== undefined && (
              <li>You have {turnSeconds} seconds per turn.</li>
            )}
          </ul>
          {CARDS[game].map((section) => (
            <section key={section.title}>
              <h3 className='mb-2 text-xs font-bold tracking-wide text-mute uppercase'>
                {section.title}
              </h3>
              <ul className='space-y-2.5'>
                {section.cards.map((entry) => (
                  <li key={entry.card} className='flex items-center gap-3'>
                    <UnoCard
                      card={c(entry.card)}
                      side={section.side}
                      w='2.6rem'
                    />
                    <span className='min-w-0'>
                      <span className='block font-semibold'>{entry.name}</span>
                      <span className='block text-[13px] text-mute'>
                        {entry.does}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
