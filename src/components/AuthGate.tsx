'use client';

import * as React from 'react';

import Login from '@/components/Login';

interface AuthContextValue {
  /** Ends the session on the server and shows the login screen. */
  logout: () => Promise<void>;
  /** Shows the login screen, e.g. after an API call answered 401. */
  expire: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthGate>');
  return ctx;
}

/** Renders its children only while the visitor has a valid OTP session. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false));
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      logout: async () => {
        await fetch('/api/logout', { method: 'POST' }).catch(() => null);
        setAuthed(false);
      },
      expire: () => setAuthed(false),
    }),
    [],
  );

  if (authed === null) return <div className='h-dvh bg-paper' />;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
