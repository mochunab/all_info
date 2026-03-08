import type { Metadata } from 'next';
import Link from 'next/link';
import { getActiveSources, getArticlesBySource, getPopularTags } from '@/lib/seo-queries';
import SeoArticleList from '@/components/SeoArticleList';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';
import { localePath } from '@/lib/locale-path';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; name: string }>;
};

export async function generateStaticParams() {
  const sources = await getActiveSources();
  return sources.map((s) => ({ name: s.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, name } = await params;
  const sourceName = decodeURIComponent(name);
  const path = `/sources/${encodeURIComponent(sourceName)}`;
  return {
    title: `${sourceName} - 소스별 아티클`,
    description: `${sourceName}에서 발행한 최신 비즈니스 인사이트 아티클을 확인하세요.`,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: buildAlternateLanguages(path),
    },
    openGraph: {
      title: `${sourceName} - 소스별 아티클 | 아카인포`,
      description: `${sourceName}의 최신 아티클`,
      type: 'website',
    },
  };
}

export default async function SourcePage({ params }: Props) {
  const { locale, name } = await params;
  const sourceName = decodeURIComponent(name);
  const lp = (p: string) => localePath(locale, p);
  const [articles, tags] = await Promise.all([
    getArticlesBySource(sourceName),
    getPopularTags(15),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${sourceName} - 소스별 아티클`,
    url: `https://aca-info.com${lp(`/sources/${encodeURIComponent(sourceName)}`)}`,
    numberOfItems: articles.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '소스', href: lp('/sources') }, { label: sourceName }]} locale={locale} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{sourceName}</h1>

      <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-8">
        <SeoArticleList articles={articles} locale={locale} />

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <h2 className="text-xs font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">인기 태그</h2>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Link
                  key={t.tag}
                  href={lp(`/tags/${encodeURIComponent(t.tag)}`)}
                  className="px-2.5 py-1 text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors duration-200"
                >
                  #{t.tag}
                </Link>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <Link href={lp('/sources')} className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                전체 소스
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
