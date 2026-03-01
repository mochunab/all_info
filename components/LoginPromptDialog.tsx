'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type LoginPromptDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function LoginPromptDialog({ isOpen, onClose }: LoginPromptDialogProps) {
  const router = useRouter();

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

      <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 border border-[var(--border)] animate-in fade-in-0 zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          나만의 피드
        </h2>

        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          백만가지 콘텐츠를 한 곳에서!<br />
          로그인하고 나만의 콘텐츠 피드를 만들어보세요.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            취소
          </button>

          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          >
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}
