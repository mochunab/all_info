import type { Metadata } from 'next';
import Link from 'next/link';
import { getCategories } from '@/lib/seo-queries';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '토픽 - 카테고리별 아티클',
  description: '아카인포의 비즈니스 인사이트를 카테고리별로 탐색하세요. 마케팅, 소비 트렌드, 스타트업 등 다양한 주제의 최신 아티클을 확인할 수 있습니다.',
  alternates: { canonical: '/topics', languages: buildAlternateLanguages('/topics') },
  openGraph: {
    title: '토픽 - 카테고리별 아티클 | 아카인포',
    description: '비즈니스 인사이트를 카테고리별로 탐색하세요.',
    type: 'website',
  },
};

export default async function TopicsPage() {
  const categories = await getCategories();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '토픽 - 카테고리별 아티클',
    description: '아카인포의 카테고리별 아티클 모음',
    url: 'https://aca-info.com/topics',
    numberOfItems: categories.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: '토픽' }]} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">토픽</h1>
      <p className="text-[var(--text-secondary)] mb-8">카테고리별로 아티클을 탐색하세요.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((cat) => (
          <Link
            key={cat.name}
            href={`/topics/${encodeURIComponent(cat.name)}`}
            className="card p-4 hover:border-[var(--accent)] transition-colors group"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
              {cat.name}
            </h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">아티클 {cat.count}개</p>
          </Link>
        ))}
      </div>

      <nav className="mt-12 pt-6 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--text-tertiary)] mb-3">더 탐색하기</p>
        <div className="flex gap-4">
          <Link href="/tags" className="text-sm text-[var(--accent)] hover:underline">태그별 탐색</Link>
          <Link href="/sources" className="text-sm text-[var(--accent)] hover:underline">소스별 탐색</Link>
        </div>
      </nav>
    </main>
  );
}
