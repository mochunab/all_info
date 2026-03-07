import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPost, getBlogSlugs, getBlogPosts } from '@/lib/blog';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/blog/${slug}`,
      languages: buildAlternateLanguages(`/blog/${slug}`),
    },
    openGraph: {
      title: `${post.title} | 아카인포 블로그`,
      description: post.description,
      type: 'article',
      images: [post.cover_image || `https://aca-info.com/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(post.description.substring(0, 100))}&type=blog`],
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, allPosts] = await Promise.all([
    getBlogPost(slug),
    getBlogPosts(),
  ]);

  if (!post) notFound();

  const otherPosts = allPosts.filter((p) => p.slug !== slug).slice(0, 5);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: `https://aca-info.com/blog/${slug}`,
    ...(post.cover_image ? { image: post.cover_image } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    publisher: {
      '@type': 'Organization',
      name: '아카인포',
      url: 'https://aca-info.com',
    },
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '블로그', href: '/blog' }, { label: post.title }]} />

      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-12">
        <article>
          <header className="mb-8 pb-6 border-b border-[var(--border)]">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-[var(--text-secondary)] text-base mb-4">{post.description}</p>
            <div className="flex items-center gap-3 flex-wrap">
              {post.published_at && (
                <time className="text-sm text-[var(--text-tertiary)]">
                  {new Date(post.published_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}
              {post.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] rounded-full"
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
              prose-td:px-3 prose-td:py-2 prose-td:border-[var(--border)]"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-6">
            {otherPosts.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">다른 글</h2>
                <ul className="space-y-3">
                  {otherPosts.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/blog/${p.slug}`}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors line-clamp-2 leading-snug"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {post.tags.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border)]">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">태그</h2>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/blog"
              className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
            >
              ← 블로그 목록
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
