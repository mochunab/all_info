import type { Metadata } from 'next';
import Link from 'next/link';
import { getPopularTags, getArticlesByTag, getCategories } from '@/lib/seo-queries';
import SeoArticleList from '@/components/SeoArticleList';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';
import { localePath } from '@/lib/locale-path';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; tag: string }>;
};

export async function generateStaticParams() {
  const tags = await getPopularTags(50);
  return tags.map((t) => ({ tag: t.tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tag } = await params;
  const name = decodeURIComponent(tag);
  const path = `/tags/${encodeURIComponent(name)}`;
  return {
    title: `#${name} - 태그별 아티클`,
    description: `'${name}' 태그가 달린 최신 비즈니스 인사이트 아티클을 확인하세요.`,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: buildAlternateLanguages(path),
    },
    openGraph: {
      title: `#${name} - 태그별 아티클 | 아카인포`,
      description: `'${name}' 태그의 최신 아티클`,
      type: 'website',
    },
  };
}

export default async function TagPage({ params }: Props) {
  const { locale, tag } = await params;
  const name = decodeURIComponent(tag);
  const lp = (p: string) => localePath(locale, p);
  const [articles, categories] = await Promise.all([
    getArticlesByTag(name),
    getCategories(),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `#${name} - 태그별 아티클`,
    url: `https://aca-info.com${lp(`/tags/${encodeURIComponent(name)}`)}`,
    numberOfItems: articles.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '태그', href: '/tags' }, { label: `#${name}` }]} locale={locale} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">#{name}</h1>

      <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-8">
        <SeoArticleList articles={articles} locale={locale} />

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">카테고리</h2>
            <div className="flex flex-col gap-1.5">
              {categories.map((c) => (
                <Link
                  key={c.name}
                  href={lp(`/topics/${encodeURIComponent(c.name)}`)}
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  {c.name} ({c.count})
                </Link>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <Link href={lp('/tags')} className="text-sm text-[var(--accent)] hover:underline">← 전체 태그</Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
