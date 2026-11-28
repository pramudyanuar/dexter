import { render, screen } from '@testing-library/react';

import GameDetailPage, {
  generateStaticParams,
} from '@/app/games/info/[game]/page';
import { GAME_PAGES } from '@/features/games/catalog';

jest.mock('next/navigation', () => ({
  usePathname: () => '/games/info/dart',
  notFound: () => {
    throw new Error('Not found');
  },
}));

it('generates a detail route for every game, including alternate variants', () => {
  expect(generateStaticParams()).toEqual(
    GAME_PAGES.map(({ id }) => ({ game: id })),
  );
  expect(generateStaticParams()).toContainEqual({ game: 'unoflip' });
});

it('shows instructions and mode information with a link to the existing game', async () => {
  render(await GameDetailPage({ params: Promise.resolve({ game: 'dart' }) }));
  expect(screen.getByRole('heading', { name: 'Dart' })).toBeInTheDocument();
  expect(screen.getByText('1–4 pemain')).toBeInTheDocument();
  expect(screen.getByText('Solo dalam room')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Cara bermain' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mulai game' })).toHaveAttribute(
    'href',
    '/games/dart',
  );
  expect(localStorage.getItem('game-visits')).toBeNull();
});

it('rejects a slug that is absent from the catalog', async () => {
  await expect(
    GameDetailPage({ params: Promise.resolve({ game: 'unknown' }) }),
  ).rejects.toThrow('Not found');
});
