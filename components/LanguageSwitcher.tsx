'use client';

import { useState, useEffect, useRef } from 'react';
import type { Language } from '@/types';
import { LANGUAGES } from '@/types';

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

  const currentLangData = LANGUAGES[currentLang];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors h-[38px]"
        aria-label="언어 선택"
      >
        <span className="text-base">{currentLangData.flag}</span>
        <span className="hidden sm:inline font-medium">{currentLangData.name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {(Object.keys(LANGUAGES) as Language[]).map((lang) => {
              const langData = LANGUAGES[lang];
              return (
                <button
                  key={lang}
                  onClick={() => {
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
