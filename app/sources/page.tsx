import type { Metadata } from 'next';
import Link from 'next/link';
import { getActiveSources } from '@/lib/seo-queries';
import { SOURCE_COLORS, DEFAULT_SOURCE_COLOR } from '@/types';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '소스 - 콘텐츠 출처',
  description: '아카인포가 큐레이션하는 비즈니스 콘텐츠 소스 목록입니다. 다양한 출처의 인사이트를 확인하세요.',
  alternates: { canonical: '/sources' },
  openGraph: {
    title: '소스 - 콘텐츠 출처 | 아카인포',
    description: '아카인포가 큐레이션하는 콘텐츠 소스 목록',
    type: 'website',
  },
};

export default async function SourcesIndexPage() {
  const sources = await getActiveSources();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '소스 - 콘텐츠 출처',
    description: '아카인포 큐레이션 콘텐츠 소스 목록',
    url: 'https://aca-info.com/sources',
    numberOfItems: sources.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '소스' }]} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">소스</h1>
      <p className="text-[var(--text-secondary)] mb-8">아카인포가 큐레이션하는 콘텐츠 출처입니다.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((src) => {
          const color = SOURCE_COLORS[src.name] || DEFAULT_SOURCE_COLOR;
          return (
            <Link
              key={src.name}
              href={`/sources/${encodeURIComponent(src.name)}`}
              className="card p-4 hover:border-[var(--accent)] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <h2 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  {src.name}
                </h2>
              </div>
              <p className="text-sm text-[var(--text-tertiary)] mt-1 ml-5">아티클 {src.count}개</p>
            </Link>
          );
        })}
      </div>

      <nav className="mt-12 pt-6 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--text-tertiary)] mb-3">더 탐색하기</p>
        <div className="flex gap-4">
          <Link href="/topics" className="text-sm text-[var(--accent)] hover:underline">카테고리별 탐색</Link>
          <Link href="/tags" className="text-sm text-[var(--accent)] hover:underline">태그별 탐색</Link>
        </div>
      </nav>
    </main>
  );
}
