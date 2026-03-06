import type { Metadata } from 'next';
import Link from 'next/link';
import { getActiveSources, getArticlesBySource, getPopularTags } from '@/lib/seo-queries';
import SeoArticleList from '@/components/SeoArticleList';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';

export const revalidate = 3600;

type Props = {
  params: Promise<{ name: string }>;
};

export async function generateStaticParams() {
  const sources = await getActiveSources();
  return sources.map((s) => ({ name: s.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const sourceName = decodeURIComponent(name);
  return {
    title: `${sourceName} - 소스별 아티클`,
    description: `${sourceName}에서 발행한 최신 비즈니스 인사이트 아티클을 확인하세요.`,
    alternates: { canonical: `/sources/${encodeURIComponent(sourceName)}` },
    openGraph: {
      title: `${sourceName} - 소스별 아티클 | 아카인포`,
      description: `${sourceName}의 최신 아티클`,
      type: 'website',
    },
  };
}

export default async function SourcePage({ params }: Props) {
  const { name } = await params;
  const sourceName = decodeURIComponent(name);
  const [articles, tags] = await Promise.all([
    getArticlesBySource(sourceName),
    getPopularTags(15),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${sourceName} - 소스별 아티클`,
    url: `https://aca-info.com/sources/${encodeURIComponent(sourceName)}`,
    numberOfItems: articles.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '소스', href: '/sources' }, { label: sourceName }]} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{sourceName}</h1>

      <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-8">
        <SeoArticleList articles={articles} />

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">인기 태그</h2>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Link
                  key={t.tag}
                  href={`/tags/${encodeURIComponent(t.tag)}`}
                  className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded hover:text-[var(--accent)] transition-colors"
                >
                  #{t.tag}
                </Link>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <Link href="/sources" className="text-sm text-[var(--accent)] hover:underline">← 전체 소스</Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
