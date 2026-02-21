import { createServiceClient } from '@/lib/supabase/server';
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

export default async function AddSourcePage() {
  const supabase = createServiceClient();

  // 서버에서 직접 Supabase 병렬 조회 (API 라우트 경유 X)
  const [sourcesResult, categoriesResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('crawl_sources').select('*').order('priority', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('categories').select('*')
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
    />
  );
}
