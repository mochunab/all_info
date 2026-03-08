'use client';

import { useEffect } from 'react';
import type { Language } from '@/types';
import { t } from '@/lib/i18n';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  language: Language;
  variant?: 'danger' | 'default';
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  language,
  variant = 'default',
}: ConfirmDialogProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  // body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
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
        aria-labelledby="confirm-dialog-title"
      >
        <h2 id="confirm-dialog-title" className="text-xl font-bold text-[var(--text-primary)] mb-2">
          {title}
        </h2>

        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
          >
            {cancelText || t(language, 'dialog.cancel')}
          </button>

          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
            }`}
            style={{ transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
          >
            {confirmText || t(language, 'dialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
