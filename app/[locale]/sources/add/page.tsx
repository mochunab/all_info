import type { Metadata } from 'next';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getMasterUserId } from '@/lib/user';
import SourcesPageClient from './SourcesPageClient';

export const metadata: Metadata = {
  title: '링크 관리',
};

type SourceLink = {
  id: string;
  url: string;
  name: string;
  crawlerType: string;
  isExisting: boolean;
};

type Category = {
  id: number;
  name: string;
  is_default: boolean;
  translations?: Record<string, string>;
};

export const dynamic = 'force-dynamic';

export default async function AddSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ user_id?: string }>;
}) {
  const [params, masterId] = await Promise.all([
    searchParams,
    getMasterUserId(),
  ]);
  const isHomeFeedContext = !params.user_id;
  const effectiveUserId = params.user_id || masterId;

  const supabase = createServiceClient();

  // 모든 비동기 작업 병렬 실행: auth 체크 + sources + categories
  const authPromise = isHomeFeedContext
    ? createClient().then((c) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).auth.getUser().then(({ data: { user } }: { data: { user: { id: string } | null } }) =>
          !user || user.id !== masterId
        )
      )
    : Promise.resolve(false);

  const [readOnly, sourcesResult, categoriesResult] = await Promise.all([
    authPromise,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('crawl_sources').select('*').eq('user_id', effectiveUserId).order('priority', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('categories').select('*').eq('user_id', effectiveUserId)
      .order('display_order', { ascending: true, nullsFirst: false }).order('name'),
  ]);

  const sources = sourcesResult.data || [];
  const categoriesRaw = categoriesResult.data || [];

  // parseData 로직 (기존 page.tsx 168-201줄)
  let cats: Category[] = [];
  const dbCatNames = new Set<string>();
  if (categoriesRaw.length > 0) {
    cats = categoriesRaw;
    cats.forEach((c: Category) => dbCatNames.add(c.name));
  }

  const grouped: Record<string, SourceLink[]> = {};
  for (const cat of cats) {
    grouped[cat.name] = [];
  }

  if (sources.length > 0) {
    for (const s of sources) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const srcCategory = (s.config as any)?.category || (cats[0]?.name || '기타');
      if (!grouped[srcCategory]) {
        grouped[srcCategory] = [];
        const existingCat = cats.find((c) => c.name === srcCategory);
        if (!existingCat) {
          cats.push({ id: Date.now(), name: srcCategory, is_default: false });
        }
      }
      grouped[srcCategory].push({
        id: s.id.toString(),
        url: s.base_url,
        name: s.name,
        crawlerType: s.crawler_type || 'AUTO',
        isExisting: true,
      });
    }
  }

  return (
    <SourcesPageClient
      initialCategories={cats}
      initialSourcesByCategory={grouped}
      initialActiveCategory={cats[0]?.name || ''}
      readOnly={readOnly}
      userId={effectiveUserId}
    />
  );
}
