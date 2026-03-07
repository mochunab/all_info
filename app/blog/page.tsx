import type { Metadata } from 'next';
import Link from 'next/link';
import { getBlogPosts } from '@/lib/blog';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '블로그 - 면접·취업 팁',
  description: '면접 준비, 취업 팁, 커리어 성장에 도움이 되는 블로그 글을 확인하세요.',
  alternates: { canonical: '/blog', languages: buildAlternateLanguages('/blog') },
  openGraph: {
    title: '블로그 - 면접·취업 팁 | 아카인포',
    description: '면접 준비, 취업 팁, 커리어 성장에 도움이 되는 블로그 글을 확인하세요.',
    type: 'website',
  },
};

export default async function BlogPage() {
  const posts = await getBlogPosts();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '블로그 - 면접·취업 팁',
    description: '면접 준비, 취업 팁, 커리어 성장 블로그',
    url: 'https://aca-info.com/blog',
    numberOfItems: posts.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '블로그' }]} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">블로그</h1>
      <p className="text-[var(--text-secondary)] mb-8">면접 준비와 취업에 도움이 되는 글을 모았습니다.</p>

      {posts.length === 0 ? (
        <p className="text-[var(--text-tertiary)]">아직 게시된 글이 없습니다.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="card p-5 hover:border-[var(--accent)] transition-colors group"
            >
              <h2 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                {post.title}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">
                {post.description}
              </p>
              <div className="flex items-center gap-3 mt-3">
                {post.published_at && (
                  <time className="text-xs text-[var(--text-tertiary)]">
                    {new Date(post.published_at).toLocaleDateString('ko-KR')}
                  </time>
                )}
                {post.tags.length > 0 && (
                  <div className="flex gap-1.5">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
