import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPost, getBlogSlugs, getBlogPosts, getBlogTranslationSlugs } from '@/lib/blog';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { localePath } from '@/lib/locale-path';
import { t } from '@/lib/i18n';
import type { Language } from '@/types';

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((s) => ({ slug: s.slug, locale: s.language || 'ko' }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const lang = locale as Language;
  const post = await getBlogPost(slug, locale);
  if (!post) return {};

  const translationSlugs = await getBlogTranslationSlugs(post.translation_group_id);
  const languages: Record<string, string> = {};
  for (const [l, s] of Object.entries(translationSlugs)) {
    languages[l] = `https://aca-info.com/${l}/blog/${s}`;
  }
  languages['x-default'] = `https://aca-info.com/ko/blog/${translationSlugs['ko'] || slug}`;

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/${locale}/blog/${slug}`,
      languages,
    },
    openGraph: {
      title: `${post.title} | ${t(lang, 'blog.ogSuffix')}`,
      description: post.description,
      type: 'article',
      images: [post.cover_image || `https://aca-info.com/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(post.description.substring(0, 100))}&type=blog`],
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const lang = locale as Language;
  const lp = (p: string) => localePath(locale, p);
  const [post, allPosts] = await Promise.all([
    getBlogPost(slug, locale),
    getBlogPosts(locale),
  ]);

  if (!post) notFound();

  const otherPosts = allPosts.filter((p) => p.slug !== slug).slice(0, 5);

  const ogImage = post.cover_image || `https://aca-info.com/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(post.description.substring(0, 100))}&type=blog`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: `https://aca-info.com${lp(`/blog/${slug}`)}`,
    image: ogImage,
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    author: {
      '@type': 'Organization',
      name: '아카인포',
      url: 'https://aca-info.com',
    },
    publisher: {
      '@type': 'Organization',
      name: '아카인포',
      url: 'https://aca-info.com',
      logo: { '@type': 'ImageObject', url: 'https://aca-info.com/logo.png' },
    },
  };

  return (
    <main className="max-w-5xl mx-auto px-4 pt-8 sm:pt-12 pb-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: t(lang, 'blog.title'), href: lp('/blog') }, { label: post.title }]} locale={locale} />

      {/* 하단 스티키 CTA — 본문 article 너비에만 맞춤 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-5xl mx-auto px-4 lg:grid lg:grid-cols-[1fr_260px] lg:gap-12">
          <div className="pointer-events-auto py-3">
            <a
              href={`https://aca-info.com/${locale}?utm_source=blog&utm_medium=${slug}&utm_campaign=sticky-cta`}
              className="btn btn-primary w-full py-3 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              {t(lang, 'blog.cta')}
            </a>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-12">
        <article>
          <header className="mb-10 pb-8 border-b border-[var(--border)]">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-[var(--text-secondary)] text-base mb-5 leading-relaxed">{post.description}</p>
            <div className="flex items-center gap-3 flex-wrap">
              {post.published_at && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <time>
                    {new Date(post.published_at).toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              )}
              {post.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 text-xs font-medium bg-[var(--accent-light)] text-[var(--accent)] rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </header>

          <div
            className="prose prose-neutral dark:prose-invert prose-lg max-w-none
              prose-headings:text-[var(--text-primary)] prose-headings:font-bold
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-[var(--border)]
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed
              prose-li:text-[var(--text-secondary)]
              prose-strong:text-[var(--text-primary)]
              prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline
              prose-table:text-sm
              prose-th:bg-[var(--bg-tertiary)] prose-th:px-3 prose-th:py-2
              prose-td:px-3 prose-td:py-2 prose-td:border-[var(--border)]
              prose-pre:bg-[#f5f5f5] prose-pre:text-[#333] prose-pre:text-sm prose-pre:leading-snug prose-pre:tracking-normal
              prose-code:text-sm prose-code:tracking-normal"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-5">
            {otherPosts.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border)]">
                <h2 className="text-xs font-semibold text-[var(--text-tertiary)] mb-4 uppercase tracking-wider">{t(lang, 'blog.otherPosts')}</h2>
                <ul className="space-y-3">
                  {otherPosts.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={lp(`/blog/${p.slug}`)}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200 line-clamp-2 leading-snug"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {post.tags.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border)]">
                <h2 className="text-xs font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">{t(lang, 'blog.tags')}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs font-medium bg-[var(--accent-light)] text-[var(--accent)] rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Link
              href={lp('/blog')}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t(lang, 'blog.backToList')}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
