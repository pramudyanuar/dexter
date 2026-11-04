import { render, screen } from '@testing-library/react';

import AppsPage from '@/app/apps/page';

function mockSession(authed: boolean) {
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ authed }),
  }) as unknown as typeof fetch;
}

describe('Apps (launcher)', () => {
  it('asks for an OTP when there is no session', async () => {
    mockSession(false);
    render(<AppsPage />);

    expect(await screen.findByLabelText(/Kode OTP/i)).toBeInTheDocument();
  });

  it('lists the apps when logged in', async () => {
    mockSession(true);
    render(<AppsPage />);

    const link = await screen.findByRole('link', { name: /ai\// });
    expect(link).toHaveAttribute('href', '/chat');
    expect(
      screen.getByRole('button', { name: /:logout/i }),
    ).toBeInTheDocument();
  });
});
