'use client';

import { useState, useEffect, useRef } from 'react';
import type { Language } from '@/types';
import { LANGUAGES } from '@/types';
import { event as gaEvent } from '@/lib/gtag';

type LanguageSwitcherProps = {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
};

export default function LanguageSwitcher({
  currentLang,
  onLanguageChange,
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const _currentLangData = LANGUAGES[currentLang]; // eslint-disable-line @typescript-eslint/no-unused-vars

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-full text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        aria-label="언어 선택"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {(Object.keys(LANGUAGES) as Language[]).map((lang) => {
              const langData = LANGUAGES[lang];
              return (
                <button
                  key={lang}
                  onClick={() => {
                    gaEvent({ action: 'language_change', category: 'settings', label: lang });
                    onLanguageChange(lang);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-3 ${
                    currentLang === lang
                      ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <span className="text-base">{langData.flag}</span>
                  <span className="font-medium">{langData.name}</span>
                  {currentLang === lang && (
                    <svg
                      className="w-4 h-4 ml-auto"
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
  );
}
