import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategories, getArticlesByCategory, getPopularTags } from '@/lib/seo-queries';
import SeoArticleList from '@/components/SeoArticleList';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const revalidate = 3600;

type Props = {
  params: Promise<{ category: string }>;
};

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ category: c.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const name = decodeURIComponent(category);
  return {
    title: `${name} - 아티클 모음`,
    description: `${name} 카테고리의 최신 비즈니스 인사이트 아티클을 확인하세요.`,
    alternates: {
      canonical: `/topics/${encodeURIComponent(name)}`,
      languages: buildAlternateLanguages(`/topics/${encodeURIComponent(name)}`),
    },
    openGraph: {
      title: `${name} - 아티클 모음 | 아카인포`,
      description: `${name} 카테고리의 최신 아티클`,
      type: 'website',
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const name = decodeURIComponent(category);
  const [articles, tags] = await Promise.all([
    getArticlesByCategory(name),
    getPopularTags(15),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${name} - 아티클 모음`,
    url: `https://aca-info.com/topics/${encodeURIComponent(name)}`,
    numberOfItems: articles.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '토픽', href: '/topics' }, { label: name }]} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{name}</h1>

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
              <Link href="/topics" className="text-sm text-[var(--accent)] hover:underline">← 전체 토픽</Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
