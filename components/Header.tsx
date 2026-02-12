'use client';

import Link from 'next/link';
import type { Language } from '@/types';
import { t } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';

type HeaderProps = {
  lastUpdated?: string;
  onRefresh?: () => void;
  isCrawling?: boolean;
  crawlProgress?: string;
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
};

export default function Header({
  lastUpdated,
  onRefresh,
  isCrawling = false,
  crawlProgress,
  language = 'ko',
  onLanguageChange,
}: HeaderProps) {
  const getUpdateText = () => {
    if (!lastUpdated) return t(language, 'header.updateWaiting');

    const date = new Date(lastUpdated);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return t(language, 'header.updateToday', { time: `${hours}:${minutes}` });
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      return t(language, 'header.updateDate', {
        date: `${month}/${day}`,
        hour: String(hours),
      });
    }
  };

  const handleRefresh = () => {
    if (!onRefresh || isCrawling) return;
    onRefresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
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
                {/* Archive Box Icon */}
                <path d="M3 6h18v2H3z" fill="currentColor" />
                <rect x="4" y="8" width="16" height="12" rx="1" />
                <path d="M9 12h6M9 15h4" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <h1
                className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]"
                style={{ fontFamily: 'Pretendard, sans-serif' }}
              >
                아카인포
              </h1>
            </div>
          </Link>

          {/* Right Side: Update Badge + Buttons */}
          <div className="flex items-center gap-3">
            {/* Update Badge / Crawl Progress */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] rounded-full border border-[var(--border)]">
              <span className="relative flex h-2 w-2">
                <span className={`pulse-dot absolute inline-flex h-full w-full rounded-full opacity-75 ${isCrawling ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isCrawling ? 'bg-amber-500' : 'bg-green-500'}`}></span>
              </span>
              <span className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
                {isCrawling ? (crawlProgress || t(language, 'header.crawling')) : getUpdateText()}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isCrawling}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
            >
              <svg
                className={`w-4 h-4 ${isCrawling ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="hidden sm:inline">
                {isCrawling ? t(language, 'header.refreshing') : t(language, 'header.refresh')}
              </span>
            </button>

            {/* Language Switcher */}
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
