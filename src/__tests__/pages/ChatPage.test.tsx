import { render, screen } from '@testing-library/react';

import ChatPage from '@/app/chat/page';

// react-markdown is ESM-only and not needed to test the page shell
jest.mock('@/components/Markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

describe('Chat page', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ authed: true }),
    }) as unknown as typeof fetch;
  });

  it('renders the chat UI when logged in', async () => {
    render(<ChatPage />);

    expect(await screen.findByText(/nothing to commit/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kirim/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '~' })).toHaveAttribute(
      'href',
      '/apps',
    );
  });
});
