import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Header, Footer } from '@/components';
import CryptoDashboard from './CryptoDashboard';

export const metadata: Metadata = {
  title: '밈코인 예측기',
};

export default async function CryptoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // master 계정 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRow } = await (supabase as any)
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userRow?.role !== 'master') {
    redirect(`/${locale}`);
  }

  // 초기 시그널 데이터 fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latestComputed } = await (supabase as any)
    .from('crypto_signals')
    .select('computed_at')
    .eq('time_window', '24h')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  let initialSignals = [];
  if (latestComputed) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: signals } = await (supabase as any)
      .from('crypto_signals')
      .select('*')
      .eq('time_window', '24h')
      .eq('computed_at', latestComputed.computed_at)
      .order('weighted_score', { ascending: false })
      .limit(100);

    initialSignals = signals || [];
  }

  return (
    <>
      <Header language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <CryptoDashboard initialSignals={initialSignals} />
      </main>
      <Footer language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
    </>
  );
}
