'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/language-context';
import { localePath } from '@/lib/locale-path';

type LoginPromptDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function LoginPromptDialog({ isOpen, onClose }: LoginPromptDialogProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) onClose();
  }, [isOpen, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleEsc]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      dialogRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-[400px] overflow-hidden dialog-enter outline-none"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        tabIndex={-1}
      >
        {/* Content */}
        <div className="px-6 pt-6 pb-5">
          <h2
            id="login-prompt-title"
            className="text-lg font-bold mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('loginPrompt.title')}
          </h2>

          <p
            className="text-sm"
            style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
          >
            {t('loginPrompt.description1')}<br />
            {t('loginPrompt.description2')}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-2.5 px-6 py-4"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--border-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            {t('loginPrompt.cancel')}
          </button>

          <button
            onClick={() => router.push(localePath(language, '/login'))}
            className="px-4 py-2.5 text-sm font-medium text-white rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              backgroundColor: 'var(--accent)',
              transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
          >
            {t('loginPrompt.login')}
          </button>
        </div>
      </div>
    </div>
  );
}
