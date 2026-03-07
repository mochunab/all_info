'use client';

import type { Language } from '@/types';
import { t } from '@/lib/i18n';
import LocaleLink from './LocaleLink';

type FooterProps = {
  language: Language;
};

export default function Footer({ language }: FooterProps) {
  return (
    <footer className="border-t border-[var(--border)] mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col items-center gap-1 text-xs text-[var(--text-tertiary)]">
        <span>{t(language, 'footer.description')}</span>
        <LocaleLink href="/terms" className="hover:text-[var(--text-secondary)] transition-colors">
          {t(language, 'footer.terms')}
        </LocaleLink>
      </div>
    </footer>
  );
}
