import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export type AuthUser = {
  id: string;
  email?: string;
  displayName: string;
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

function mapSupabaseUser(id: string, email?: string | null): AuthUser {
  return {
    id,
    email: email ?? undefined,
    displayName: email?.split('@')[0] ?? 'You',
    isDevBypass: false,
  };
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
      setUser(sessionUser ? mapSupabaseUser(sessionUser.id, sessionUser.email) : null);
      setIsReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      setUser(sessionUser ? mapSupabaseUser(sessionUser.id, sessionUser.email) : null);
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

        const redirectTo =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.origin
            : 'kinexus://auth/callback';

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: false,
          },
        });

        if (error) {
          throw error;
        }
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
