'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LocaleLink from '@/components/LocaleLink';
import { createClient } from '@/lib/supabase/client';
import { event as gaEvent } from '@/lib/gtag';
import { useLanguage } from '@/lib/language-context';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    gaEvent({ action: 'login', category: 'auth', label: 'email' });
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full blur-3xl opacity-[0.1]"
          style={{ backgroundColor: '#2563EB' }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full blur-3xl opacity-[0.06]"
          style={{ backgroundColor: '#3B82F6' }}
        />
      </div>

      <div
        className="relative w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border)] p-8"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-8">
          {t('login.title')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              style={{ transition: 'border-color 200ms cubic-bezier(0.2, 0, 0, 1), box-shadow 200ms cubic-bezier(0.2, 0, 0, 1)' }}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              style={{ transition: 'border-color 200ms cubic-bezier(0.2, 0, 0, 1), box-shadow 200ms cubic-bezier(0.2, 0, 0, 1)' }}
              placeholder={t('login.passwordPlaceholder')}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            style={{ transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
          >
            {isLoading ? t('login.loggingIn') : t('login.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-tertiary)]">
          {t('login.noAccount')}{' '}
          <LocaleLink href="/signup" className="text-[var(--accent)] hover:underline font-medium cursor-pointer">
            {t('login.signup')}
          </LocaleLink>
        </p>
      </div>
    </div>
  );
}
