import type { Metadata } from 'next';
import Link from 'next/link';
import { getPopularTags } from '@/lib/seo-queries';
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
    title: '태그 - 키워드별 아티클',
    description: '아카인포의 비즈니스 아티클을 태그별로 탐색하세요. AI, 마케팅, 브랜딩 등 인기 키워드로 관련 아티클을 찾아보세요.',
    alternates: { canonical: `/${locale}/tags`, languages: buildAlternateLanguages('/tags') },
    openGraph: {
      title: '태그 - 키워드별 아티클 | 아카인포',
      description: '인기 태그별로 아티클을 탐색하세요.',
      type: 'website',
    },
  };
}

export default async function TagsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lp = (p: string) => localePath(locale, p);
  const tags = await getPopularTags(50);

  const maxCount = tags[0]?.count || 1;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '태그 - 키워드별 아티클',
    description: '아카인포의 인기 태그 모음',
    url: `https://aca-info.com${lp('/tags')}`,
    numberOfItems: tags.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '태그' }]} locale={locale} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">태그</h1>
      <p className="text-[var(--text-secondary)] mb-8">인기 키워드로 아티클을 탐색하세요.</p>

      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const ratio = t.count / maxCount;
          const size = ratio > 0.7 ? 'text-lg font-semibold' : ratio > 0.3 ? 'text-base' : 'text-sm';
          return (
            <Link
              key={t.tag}
              href={lp(`/tags/${encodeURIComponent(t.tag)}`)}
              className={`px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-secondary)] transition-colors ${size}`}
            >
              #{t.tag}
              <span className="text-xs text-[var(--text-tertiary)] ml-1">({t.count})</span>
            </Link>
          );
        })}
      </div>

      <nav className="mt-12 pt-6 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--text-tertiary)] mb-3">더 탐색하기</p>
        <div className="flex gap-4">
          <Link href={lp('/topics')} className="text-sm text-[var(--accent)] hover:underline">카테고리별 탐색</Link>
          <Link href={lp('/sources')} className="text-sm text-[var(--accent)] hover:underline">소스별 탐색</Link>
          <Link href={lp('/authors')} className="text-sm text-[var(--accent)] hover:underline">저자별 탐색</Link>
        </div>
      </nav>
    </main>
  );
}
