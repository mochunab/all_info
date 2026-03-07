import type { Metadata } from 'next';
import Link from 'next/link';
import { getActiveAuthors, getArticlesByAuthor, getPopularTags } from '@/lib/seo-queries';
import SeoArticleList from '@/components/SeoArticleList';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const revalidate = 3600;

type Props = {
  params: Promise<{ name: string }>;
};

export async function generateStaticParams() {
  const authors = await getActiveAuthors(100);
  return authors.map((a) => ({ name: a.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const authorName = decodeURIComponent(name);
  return {
    title: `${authorName} - 저자별 아티클`,
    description: `${authorName} 저자의 최신 비즈니스 인사이트 아티클을 확인하세요.`,
    alternates: {
      canonical: `/authors/${encodeURIComponent(authorName)}`,
      languages: buildAlternateLanguages(`/authors/${encodeURIComponent(authorName)}`),
    },
    openGraph: {
      title: `${authorName} - 저자별 아티클 | 아카인포`,
      description: `${authorName}의 최신 아티클`,
      type: 'website',
    },
  };
}

export default async function AuthorPage({ params }: Props) {
  const { name } = await params;
  const authorName = decodeURIComponent(name);
  const [articles, tags] = await Promise.all([
    getArticlesByAuthor(authorName),
    getPopularTags(15),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${authorName} - 저자별 아티클`,
    url: `https://aca-info.com/authors/${encodeURIComponent(authorName)}`,
    numberOfItems: articles.length,
    author: {
      '@type': 'Person',
      name: authorName,
    },
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '저자', href: '/authors' }, { label: authorName }]} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{authorName}</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{articles.length}편의 아티클</p>

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
              <Link href="/authors" className="text-sm text-[var(--accent)] hover:underline">&larr; 전체 저자</Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
