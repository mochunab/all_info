'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-8">
          로그인
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="6자 이상"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-tertiary)]">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-[var(--accent)] hover:underline font-medium">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
