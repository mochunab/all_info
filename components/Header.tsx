'use client';

import { useState } from 'react';
import Link from 'next/link';

interface HeaderProps {
  lastUpdated?: string;
  onRefresh?: () => Promise<void>;
}

export default function Header({ lastUpdated, onRefresh }: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getUpdateText = () => {
    if (!lastUpdated) return '업데이트 대기중';

    const date = new Date(lastUpdated);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `오늘 ${hours}:${minutes} 업데이트`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours();
      return `${month}/${day} ${hours}시 업데이트`;
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
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
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <h1
                className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Insight Hub
              </h1>
            </div>
          </Link>

          {/* Right Side: Update Badge + Refresh Button */}
          <div className="flex items-center gap-3">
            {/* Update Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] rounded-full border border-[var(--border)]">
              <span className="relative flex h-2 w-2">
                <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
                {getUpdateText()}
              </span>
            </div>

            {/* Refresh Button - 자료 불러오기 */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
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
                {isRefreshing ? '불러오는 중...' : '자료 불러오기'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
