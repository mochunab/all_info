import type { Metadata } from 'next';
import Link from 'next/link';
import { getActiveAuthors } from '@/lib/seo-queries';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '저자 - 작성자별 아티클',
  description: '아카인포의 비즈니스 아티클을 저자별로 탐색하세요. 업계 전문가들의 인사이트를 한눈에 확인할 수 있습니다.',
  alternates: { canonical: '/authors', languages: buildAlternateLanguages('/authors') },
  openGraph: {
    title: '저자 - 작성자별 아티클 | 아카인포',
    description: '저자별로 아티클을 탐색하세요.',
    type: 'website',
  },
};

export default async function AuthorsPage() {
  const authors = await getActiveAuthors(100);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '저자 - 작성자별 아티클',
    description: '아카인포의 활동 저자 모음',
    url: 'https://aca-info.com/authors',
    numberOfItems: authors.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '저자' }]} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">저자</h1>
      <p className="text-[var(--text-secondary)] mb-8">작성자별로 아티클을 탐색하세요.</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {authors.map((a) => (
          <Link
            key={a.name}
            href={`/authors/${encodeURIComponent(a.name)}`}
            className="flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{a.name}</span>
            <span className="text-xs text-[var(--text-tertiary)] ml-2 shrink-0">{a.count}편</span>
          </Link>
        ))}
      </div>

      <nav className="mt-12 pt-6 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--text-tertiary)] mb-3">더 탐색하기</p>
        <div className="flex gap-4">
          <Link href="/topics" className="text-sm text-[var(--accent)] hover:underline">카테고리별 탐색</Link>
          <Link href="/tags" className="text-sm text-[var(--accent)] hover:underline">태그별 탐색</Link>
          <Link href="/sources" className="text-sm text-[var(--accent)] hover:underline">소스별 탐색</Link>
        </div>
      </nav>
    </main>
  );
}
