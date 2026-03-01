'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Language } from '@/types';
import type { User } from '@supabase/supabase-js';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import LanguageSwitcher from './LanguageSwitcher';

type HeaderProps = {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
};

export default function Header({
  language = 'ko',
  onLanguageChange,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  };

  const NAV_ITEMS = [
    { label: '홈피드', href: '/' },
    { label: '마이피드', href: '/my-feed' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent)] text-white">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18v2H3z" fill="currentColor" />
                  <rect x="4" y="8" width="16" height="12" rx="1" />
                  <path d="M9 12h6M9 15h4" strokeWidth="1.5" />
                </svg>
              </div>
              <h1
                className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]"
                style={{ fontFamily: 'Pretendard, sans-serif' }}
              >
                아카인포
              </h1>
            </Link>

            <nav className="flex items-center gap-6">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--text-secondary)] hidden sm:inline">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {t(language, 'header.logout')}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {t(language, 'header.login')}
              </Link>
            )}

            {onLanguageChange && (
              <LanguageSwitcher
                currentLang={language}
                onLanguageChange={onLanguageChange}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
