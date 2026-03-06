import Link from 'next/link';
import type { Article } from '@/types';
import { SOURCE_COLORS, DEFAULT_SOURCE_COLOR } from '@/types';

type SeoArticleListProps = {
  articles: Article[];
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SeoArticleList({ articles }: SeoArticleListProps) {
  if (articles.length === 0) {
    return <p className="text-[var(--text-tertiary)] text-center py-12">아티클이 없습니다.</p>;
  }

  return (
    <div className="grid gap-4">
      {articles.map((article) => {
        const sourceColor = SOURCE_COLORS[article.source_name] || DEFAULT_SOURCE_COLOR;
        const title = article.title_ko || article.title;
        const summary = article.summary?.split('\n\n')[0] || '';
        const tags = article.summary_tags?.slice(0, 3) || [];

        return (
          <article key={article.id} className="card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/sources/${encodeURIComponent(article.source_name)}`}
                className="px-2 py-0.5 rounded text-white text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ backgroundColor: sourceColor }}
              >
                {article.source_name}
              </Link>
              {article.category && (
                <Link
                  href={`/topics/${encodeURIComponent(article.category)}`}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                >
                  {article.category}
                </Link>
              )}
              <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                {formatDate(article.published_at || article.crawled_at)}
              </span>
            </div>

            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--accent)] transition-colors"
              >
                {title}
              </a>
            </h3>

            {summary && (
              <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">{summary}</p>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <Link
                    key={i}
                    href={`/tags/${encodeURIComponent(tag)}`}
                    className="px-2 py-0.5 text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded hover:text-[var(--accent)] transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
