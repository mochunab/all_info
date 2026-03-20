'use client';

import { useState, useEffect } from 'react';

export function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () =>
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(check());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setDark(check());
    mq.addEventListener('change', handler);
    const obs = new MutationObserver(() => setDark(check()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', handler);
      obs.disconnect();
    };
  }, []);
  return dark;
}
