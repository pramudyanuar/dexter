import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import JsDosPlayer from '@/components/games/JsDosPlayer';

const script = () =>
  document.head.querySelector<HTMLScriptElement>('script[src*="js-dos.js"]');

afterEach(() => {
  script()?.remove();
  document.head.querySelector('link[href*="js-dos.css"]')?.remove();
  delete window.Dos;
});

it('retries with a new script after a loading error', async () => {
  const { container } = render(
    <JsDosPlayer title='DOOM' bundleUrl='/test.jsdos' controls='Panah' />,
  );
  const failed = script()!;
  fireEvent.error(failed);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Gagal memuat emulator',
  );
  expect(script()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  expect(script()).not.toBe(failed);
  window.Dos = jest.fn(() => ({}));
  fireEvent.load(script()!);
  await waitFor(() =>
    expect(window.Dos).toHaveBeenCalledWith(
      container.querySelector('.size-full'),
      {
        url: '/test.jsdos',
        autoStart: true,
        mouseCapture: true,
      },
    ),
  );
});
