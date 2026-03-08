'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/language-context';

type LoginPromptDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function LoginPromptDialog({ isOpen, onClose }: LoginPromptDialogProps) {
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative bg-[var(--bg-secondary)] w-full max-w-md mx-4 p-6 border border-[var(--border)] animate-in fade-in-0 zoom-in-95 duration-200"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
      >
        <h2 id="login-prompt-title" className="text-xl font-bold text-[var(--text-primary)] mb-2">
          {t('loginPrompt.title')}
        </h2>

        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          {t('loginPrompt.description1')}<br />
          {t('loginPrompt.description2')}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
          >
            {t('loginPrompt.cancel')}
          </button>

          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            style={{ transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
          >
            {t('loginPrompt.login')}
          </button>
        </div>
      </div>
    </div>
  );
}
