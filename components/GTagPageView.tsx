'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageview, setGtagMaster } from '@/lib/gtag';
import { useAuth } from '@/lib/auth-context';

const PAGE_NAMES: Record<string, string> = {
  '/': '홈피드',
  '/landing': '랜딩페이지',
  '/my-feed': '마이피드',
  '/blog': '블로그',
  '/login': '로그인',
  '/signup': '회원가입',
  '/sources/add': '링크 관리',
  '/terms': '이용약관',
  '/topics': '토픽 목록',
  '/tags': '태그 목록',
  '/sources': '소스 목록',
  '/authors': '저자 목록',
};

function getPageName(pathname: string): string {
  const stripped = pathname.replace(/^\/(ko|en|vi|zh|ja)/, '') || '/';

  if (PAGE_NAMES[stripped]) return PAGE_NAMES[stripped];

  if (stripped.startsWith('/blog/')) return '블로그 글';
  if (stripped.startsWith('/articles/')) return '아티클 상세';
  if (stripped.startsWith('/topics/')) return '토픽';
  if (stripped.startsWith('/tags/')) return '태그';
  if (stripped.startsWith('/sources/')) return '소스';
  if (stripped.startsWith('/authors/')) return '저자';

  return stripped;
}

export default function GTagPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMaster } = useAuth();

  useEffect(() => {
    setGtagMaster(isMaster);
  }, [isMaster]);

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '');
    const pageName = getPageName(pathname);
    pageview(url, pageName);
  }, [pathname, searchParams]);

  return null;
}
