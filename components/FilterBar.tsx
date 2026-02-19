'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/types';
import { t } from '@/lib/i18n';

type FilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
  totalCount?: number;
  language?: Language;
};

export default function FilterBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  totalCount,
  language = 'ko',
}: FilterBarProps) {
  const router = useRouter();
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      {/* Top Row: Search + Add Source Button */}
      <div className="flex gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-[var(--text-tertiary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(language, 'filter.search')}
            className="input pl-12"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Add Source Button */}
        <button
          onClick={() => router.push('/sources/add')}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors whitespace-nowrap"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="hidden sm:inline">{t(language, 'filter.addSource')}</span>
        </button>
      </div>

      {/* Second Row: Content Count (left) + Category Dropdown (right) */}
      <div className="flex items-center justify-between">
        {/* Content Count */}
        {totalCount !== undefined && (
          <p className="text-sm text-[var(--text-tertiary)]">
            {search
              ? t(language, 'filter.searchResult', { count: String(totalCount) })
              : t(language, 'filter.totalCount', { count: String(totalCount) })}
          </p>
        )}

        {/* Category Dropdown */}
        <div className="relative ml-auto" ref={dropdownRef}>
          <button
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors min-w-[140px]"
          >
            <span className="font-medium">{category || categories[0] || ''}</span>
            <svg
              className={`w-4 h-4 ml-auto transition-transform ${
                isCategoryDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isCategoryDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
                {categories.map((cat) => {
                  const isActive = category === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        onCategoryChange(cat);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between ${
                        isActive
                          ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      <span>{cat}</span>
                      {isActive && (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
