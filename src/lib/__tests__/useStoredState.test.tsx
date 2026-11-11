import { act, renderHook } from '@testing-library/react';

import useStoredState from '@/lib/useStoredState';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('useStoredState scopes', () => {
  it('keeps shared values in localStorage by default', () => {
    const { result } = renderHook(() => useStoredState('best', 0));
    act(() => result.current[1](42));
    expect(result.current[0]).toBe(42);
    expect(localStorage.getItem('best')).toBe('42');
    expect(sessionStorage.getItem('best')).toBeNull();
  });

  it('keeps a tab-scoped value in this tab only', () => {
    const { result } = renderHook(() => useStoredState('game', 'none', 'tab'));
    act(() => result.current[1]('board'));
    expect(result.current[0]).toBe('board');
    expect(sessionStorage.getItem('game')).toBe('"board"');
    // another tab would read localStorage's view of the same key: nothing
    expect(localStorage.getItem('game')).toBeNull();
  });

  it('does not mix the two scopes under one key', () => {
    localStorage.setItem('k', JSON.stringify('shared'));
    const tab = renderHook(() => useStoredState('k', 'fresh', 'tab'));
    const shared = renderHook(() => useStoredState('k', 'fresh'));
    expect(tab.result.current[0]).toBe('fresh');
    expect(shared.result.current[0]).toBe('shared');
  });
});
