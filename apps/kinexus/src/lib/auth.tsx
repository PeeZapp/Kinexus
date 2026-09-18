import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';

import { createSessionFromUrl, signInWithGoogle as startGoogleSignIn } from '@/src/lib/oauth';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export type AuthUser = {
  id: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  isDevBypass: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isReady: boolean;
  isSupabaseConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInDevBypass: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEV_USER: AuthUser = {
  id: 'dev-local-user',
  email: 'dev@localhost',
  displayName: 'Dev',
  isDevBypass: true,
};

function mapSupabaseUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : undefined;
  const name = typeof meta.name === 'string' ? meta.name : undefined;
  const avatar =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    undefined;

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: fullName || name || user.email?.split('@')[0] || 'You',
    avatarUrl: avatar,
    isDevBypass: false,
  };
}

function sameAuthUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.avatarUrl === b.avatarUrl &&
    a.isDevBypass === b.isDevBypass
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setIsReady(true);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const sessionUser = data.session?.user;
      setUser((prev) => {
        if (!sessionUser) return null;
        const next = mapSupabaseUser(sessionUser);
        return sameAuthUser(prev, next) ? prev : next;
      });
      setIsReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer so we do not deadlock with getSession inside the GoTrue client.
      setTimeout(() => {
        if (cancelled) return;
        if (event === 'SIGNED_OUT') {
          setUser(null);
          return;
        }
        const sessionUser = session?.user;
        if (!sessionUser) return;
        setUser((prev) => {
          const next = mapSupabaseUser(sessionUser);
          return sameAuthUser(prev, next) ? prev : next;
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      isSupabaseConfigured,
      signInWithGoogle: async () => {
        if (!supabase) {
          setUser(DEV_USER);
          return;
        }
        await startGoogleSignIn();
      },
      signInDevBypass: () => {
        setUser(DEV_USER);
      },
      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        setUser(null);
      },
    }),
    [isReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** Used by the /auth/callback route. Re-exported so routes do not import oauth internals twice. */
export { createSessionFromUrl };
