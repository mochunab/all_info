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

      {/* Dialog */}
      <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 border border-[var(--border)] animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Title */}
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          {title}
        </h2>

        {/* Message */}
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          {/* Cancel Button */}
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            {cancelText || t(language, 'dialog.cancel')}
          </button>

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {confirmText || t(language, 'dialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
