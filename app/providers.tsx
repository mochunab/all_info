'use client';

import { LanguageProvider } from '@/lib/language-context';
import { AuthProvider } from '@/lib/auth-context';

export default function Providers({
  children,
  locale = 'ko',
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  return (
    <AuthProvider>
      <LanguageProvider locale={locale}>{children}</LanguageProvider>
    </AuthProvider>
  );
}
