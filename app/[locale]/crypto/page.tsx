import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
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

  const cached = getCache<{ signals: unknown[] }>(CACHE_KEYS.CRYPTO_SSR);
  if (cached) {
    return (
      <>
        <Header language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
        <main className="min-h-screen bg-[var(--bg-primary)]">
          <CryptoDashboard initialSignals={cached.signals as never[]} language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
        </main>
        <Footer language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
      </>
    );
  }

  const supabase = await createClient();

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

  setCache(CACHE_KEYS.CRYPTO_SSR, { signals: initialSignals }, CACHE_TTL.CRYPTO_SIGNALS);

  return (
    <>
      <Header language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <CryptoDashboard initialSignals={initialSignals} language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
      </main>
      <Footer language={locale as 'ko' | 'en' | 'vi' | 'zh' | 'ja'} />
    </>
  );
}
