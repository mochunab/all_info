import type { Metadata } from 'next';
import Link from 'next/link';
import { getActiveSources } from '@/lib/seo-queries';
import { SOURCE_COLORS, DEFAULT_SOURCE_COLOR } from '@/types';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';
import { localePath } from '@/lib/locale-path';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: '소스 - 콘텐츠 출처',
    description: '아카인포가 큐레이션하는 비즈니스 콘텐츠 소스 목록입니다. 다양한 출처의 인사이트를 확인하세요.',
    alternates: { canonical: `/${locale}/sources`, languages: buildAlternateLanguages('/sources') },
    openGraph: {
      title: '소스 - 콘텐츠 출처 | 아카인포',
      description: '아카인포가 큐레이션하는 콘텐츠 소스 목록',
      type: 'website',
    },
  };
}

export default async function SourcesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lp = (p: string) => localePath(locale, p);
  const sources = await getActiveSources();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '소스 - 콘텐츠 출처',
    description: '아카인포 큐레이션 콘텐츠 소스 목록',
    url: `https://aca-info.com${lp('/sources')}`,
    numberOfItems: sources.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '소스' }]} locale={locale} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">소스</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">아카인포가 큐레이션하는 콘텐츠 출처입니다.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {sources.map((src) => {
          const color = SOURCE_COLORS[src.name] || DEFAULT_SOURCE_COLOR;
          return (
            <Link
              key={src.name}
              href={lp(`/sources/${encodeURIComponent(src.name)}`)}
              className="card card-hover p-5 group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors duration-200">
                    {src.name}
                  </h2>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">아티클 {src.count}개</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <nav className="mt-12 pt-6 border-t border-[var(--border)]">
        <p className="text-xs font-medium text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">더 탐색하기</p>
        <div className="flex flex-wrap gap-2">
          <Link href={lp('/topics')} className="px-4 py-2 text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors duration-200">카테고리별 탐색</Link>
          <Link href={lp('/tags')} className="px-4 py-2 text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors duration-200">태그별 탐색</Link>
          <Link href={lp('/authors')} className="px-4 py-2 text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors duration-200">저자별 탐색</Link>
        </div>
      </nav>
    </main>
  );
}
