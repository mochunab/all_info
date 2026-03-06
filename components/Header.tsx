'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Language } from '@/types';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { event as gaEvent } from '@/lib/gtag';
import { useAuth } from '@/lib/auth-context';
import LanguageSwitcher from './LanguageSwitcher';

type HeaderProps = {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
  logoHref?: string;
};

export default function Header({
  language = 'ko',
  onLanguageChange,
  logoHref = '/landing',
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    gaEvent({ action: 'logout', category: 'auth' });
    const supabase = createClient();
    await supabase.auth.signOut();
    setMobileMenuOpen(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const NAV_ITEMS = [
    { label: t(language, 'header.home'), href: '/' },
    { label: t(language, 'header.myFeed'), href: '/my-feed' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center gap-8">
            <Link href={logoHref} className="flex items-center gap-3">
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
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                {t(language, 'header.logo')}
              </h1>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-base font-medium transition-colors ${
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
                <span className="text-sm text-[var(--text-secondary)] hidden lg:inline">
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

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              aria-label="메뉴"
            >
              {mobileMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg-primary)]">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

          </div>
        </div>
      )}
    </header>
  );
}
