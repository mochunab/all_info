'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES } from '@/lib/locale-config';
import type { ComponentProps } from 'react';

const LOCALE_SET = new Set<string>(LOCALES);

function extractLocale(pathname: string): string {
  const seg = pathname.split('/')[1];
  return LOCALE_SET.has(seg) ? seg : 'ko';
}

export function useLocalePath(path: string): string {
  const pathname = usePathname();
  const locale = extractLocale(pathname);
  if (path.startsWith('/')) return `/${locale}${path}`;
  return path;
}

type LocaleLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

export default function LocaleLink({ href, ...props }: LocaleLinkProps) {
  const localizedHref = useLocalePath(href);
  return <Link href={localizedHref} {...props} />;
}
