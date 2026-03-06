'use client';

import { Header } from '@/components';
import { useLanguage } from '@/lib/language-context';

export default function LandingHeader() {
  const { language, setLanguage } = useLanguage();
  return <Header logoHref="/landing" language={language} onLanguageChange={setLanguage} />;
}
