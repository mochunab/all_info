'use client';

import { useEffect, useRef, useCallback } from 'react';
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
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) onCancel();
  }, [isOpen, onCancel]);

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

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-[400px] overflow-hidden dialog-enter"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        tabIndex={-1}
      >
        {/* Content */}
        <div className="px-6 pt-6 pb-5">
          {/* Icon */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
            style={{
              backgroundColor: isDanger ? '#FEF2F2' : 'var(--accent-light)',
            }}
          >
            {isDanger ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>

          <h2
            id="confirm-dialog-title"
            className="text-lg font-bold mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>

          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-2.5 px-6 py-4"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <button
            onClick={onCancel}
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
            {cancelText || t(language, 'dialog.cancel')}
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2.5 text-sm font-medium text-white rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              backgroundColor: isDanger ? '#DC2626' : 'var(--accent)',
              transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDanger ? '#B91C1C' : 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDanger ? '#DC2626' : 'var(--accent)';
            }}
          >
            {confirmText || t(language, 'dialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
