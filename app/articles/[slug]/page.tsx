import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getArticleSlugs, getRelatedArticles } from '@/lib/seo-queries';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  const title = article.title_ko || article.title;
  const description = article.summary
    || article.content_preview?.substring(0, 160)
    || title;

  return {
    title,
    description,
    alternates: {
      canonical: `/articles/${slug}`,
      languages: buildAlternateLanguages(`/articles/${slug}`),
    },
    openGraph: {
      title: `${title} | 아카인포`,
      description,
      type: 'article',
      images: [`https://aca-info.com/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description.substring(0, 100))}&type=article`],
      ...(article.published_at ? { publishedTime: article.published_at } : {}),
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) notFound();

  const title = article.title_ko || article.title;
  const relatedArticles = article.category
    ? await getRelatedArticles(article.category, article.id)
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: article.summary || article.content_preview?.substring(0, 160) || title,
    url: `https://aca-info.com/articles/${slug}`,
    ...(article.published_at ? { datePublished: article.published_at } : {}),
    dateModified: article.updated_at,
    ...(article.author ? { author: { '@type': 'Person', name: article.author } } : {}),
    publisher: {
      '@type': 'Organization',
      name: '아카인포',
      url: 'https://aca-info.com',
    },
  };

  const breadcrumbItems = [
    ...(article.category
      ? [{ label: article.category, href: `/topics/${encodeURIComponent(article.category)}` }]
      : []),
    { label: title },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={breadcrumbItems} />

      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-12">
        <article>
          <header className="mb-8 pb-6 border-b border-[var(--border)]">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-4">
              {title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap text-sm text-[var(--text-tertiary)]">
              {article.source_name && (
                <Link
                  href={`/sources/${encodeURIComponent(article.source_name)}`}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  {article.source_name}
                </Link>
              )}
              {article.author && (
                <Link
                  href={`/authors/${encodeURIComponent(article.author)}`}
                  className="hover:text-[var(--accent)] transition-colors"
                >
                  {article.author}
                </Link>
              )}
              {article.published_at && (
                <time>
                  {new Date(article.published_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}
            </div>
          </header>

          {article.summary && (
            <div className="bg-[var(--accent)]/5 border-l-4 border-[var(--accent)] rounded-r-lg p-5 mb-8">
              <h2 className="text-sm font-bold text-[var(--text-primary)] mb-2">AI 요약</h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {article.summary}
              </p>
            </div>
          )}

          {article.content_preview && (
            <div className="prose prose-neutral dark:prose-invert prose-lg max-w-none mb-8
              prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed">
              <p>{article.content_preview}</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[var(--border)] flex items-center gap-4">
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              원문 보기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            {article.category && (
              <Link
                href={`/topics/${encodeURIComponent(article.category)}`}
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
              >
                {article.category} 더보기 →
              </Link>
            )}
          </div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-6">
            {article.summary_tags?.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">태그</h2>
                <div className="flex flex-wrap gap-1.5">
                  {article.summary_tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/tags/${encodeURIComponent(tag)}`}
                      className="px-2.5 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full hover:text-[var(--accent)] transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {relatedArticles.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">관련 아티클</h2>
                <ul className="space-y-3">
                  {relatedArticles.map((a: { slug: string; title_ko: string | null; title: string }) => (
                    <li key={a.slug}>
                      <Link
                        href={`/articles/${a.slug}`}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors line-clamp-2 leading-snug"
                      >
                        {a.title_ko || a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
