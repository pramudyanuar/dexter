import { act, fireEvent, render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('Home (public cheatsheet)', () => {
  beforeEach(() => push.mockClear());

  it('shows a cheatsheet and nothing about the apps', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Git' })).toBeInTheDocument();
    expect(screen.getByText('git status -sb')).toBeInTheDocument();
    expect(
      screen.queryByText(/\b(chat|otp|dexter|launcher|browse|proxy)\b/i),
    ).not.toBeInTheDocument();
  });

  it('filters commands as you type', () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText('Cari'), {
      target: { value: 'reflog' },
    });
    expect(screen.getByText('git reflog')).toBeInTheDocument();
    expect(screen.queryByText('git status -sb')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cari'), {
      target: { value: 'zzzz-tidak-ada' },
    });
    expect(screen.getByText(/Tidak ada hasil/)).toBeInTheDocument();
  });

  it('opens the launcher on three quick clicks of the logo, not fewer', () => {
    jest.useFakeTimers();
    render(<HomePage />);
    const logo = screen.getByRole('button', { name: 'DevRef' });

    fireEvent.click(logo);
    fireEvent.click(logo);
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(logo);
    expect(push).toHaveBeenCalledWith('/apps');

    // slow clicks do not count
    push.mockClear();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(logo);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(push).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
