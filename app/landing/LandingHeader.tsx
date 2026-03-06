'use client';

import { useState } from 'react';
import { Header } from '@/components';
import type { Language } from '@/types';

export default function LandingHeader() {
  const [language, setLanguage] = useState<Language>('ko');
  return <Header logoHref="/landing" language={language} onLanguageChange={setLanguage} />;
}
