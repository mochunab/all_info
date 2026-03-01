import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getMasterUserId } from '@/lib/user';
import SourcesPageClient from './SourcesPageClient';

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
};

// 페이지를 항상 동적으로 렌더링 + fetch Data Cache 비활성화
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function AddSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ user_id?: string }>;
}) {
  const params = await searchParams;
  const masterId = await getMasterUserId();
  const isHomeFeedContext = !params.user_id;
  const effectiveUserId = params.user_id || masterId;

  // 홈피드 컨텍스트에서 로그인 여부 확인
  let readOnly = false;
  if (isHomeFeedContext) {
    const authClient = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (authClient as any).auth.getUser();
    if (!user || user.id !== masterId) {
      readOnly = true;
    }
  }

  const supabase = createServiceClient();

  // 서버에서 직접 Supabase 병렬 조회 (user_id로 스코핑)
  const [sourcesResult, categoriesResult] = await Promise.all([
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
    />
  );
}
