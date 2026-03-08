'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isMaster: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
      if (user) {
        supabase.from('users').select('role').eq('id', user.id).single()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ data }: { data: any }) => setIsMaster(data?.role === 'master'));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') setIsMaster(false);
      if (event === 'SIGNED_IN' && session?.user) {
        supabase.from('users').select('role').eq('id', session.user.id).single()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ data }: { data: any }) => setIsMaster(data?.role === 'master'));
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        try {
          sessionStorage.removeItem('ih:my:articles');
          sessionStorage.removeItem('ih:my:categories');
          sessionStorage.removeItem('ih:my:category');
          sessionStorage.removeItem('ih:home:articles');
          sessionStorage.removeItem('ih:home:categories');
        } catch { /* ignore */ }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isMaster }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
