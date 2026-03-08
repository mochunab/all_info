'use client';

import { Suspense } from 'react';
import { LanguageProvider } from '@/lib/language-context';
import { AuthProvider } from '@/lib/auth-context';
import GTagPageView from '@/components/GTagPageView';

export default function Providers({
  children,
  locale = 'ko',
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  return (
    <AuthProvider>
      <LanguageProvider locale={locale}>
        <Suspense fallback={null}>
          <GTagPageView />
        </Suspense>
        {children}
      </LanguageProvider>
    </AuthProvider>
  );
}
