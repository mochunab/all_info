import type { Metadata } from 'next';
import { getBlogPosts } from '@/lib/blog';
import SeoBreadcrumb from '@/components/SeoBreadcrumb';
import BlogList from '@/components/BlogList';
import { buildAlternateLanguages } from '@/lib/hreflang';
import { localePath } from '@/lib/locale-path';
import { t } from '@/lib/i18n';
import type { Language } from '@/types';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: '블로그 - 면접·취업 팁',
    description: '면접 준비, 취업 팁, 커리어 성장에 도움이 되는 블로그 글을 확인하세요.',
    alternates: { canonical: `/${locale}/blog`, languages: buildAlternateLanguages('/blog') },
    openGraph: {
      title: '블로그 - 면접·취업 팁 | 아카인포',
      description: '면접 준비, 취업 팁, 커리어 성장에 도움이 되는 블로그 글을 확인하세요.',
      type: 'website',
    },
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lang = locale as Language;
  const lp = (p: string) => localePath(locale, p);
  let posts = await getBlogPosts(locale);
  if (posts.length === 0 && locale !== 'ko') {
    posts = await getBlogPosts('ko');
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t(lang, 'blog.title'),
    description: t(lang, 'blog.subtitle'),
    url: `https://aca-info.com${lp('/blog')}`,
    numberOfItems: posts.length,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeoBreadcrumb items={[{ label: t(lang, 'blog.title') }]} locale={locale} />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{t(lang, 'blog.title')}</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{t(lang, 'blog.subtitle')}</p>

      <BlogList posts={posts} locale={locale} />
    </main>
  );
}
