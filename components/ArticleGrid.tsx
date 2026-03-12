'use client';

import type { Article, Language } from '@/types';
import { t } from '@/lib/i18n';
import ArticleCard from './ArticleCard';
import Skeleton from './Skeleton';

type ArticleGridProps = {
  articles: Article[];
  language: Language;
  isLoading?: boolean;
  hasMore?: boolean;
  search?: string;
  isChatOpen?: boolean;
  onLoadMore?: () => void;
  onDelete?: (articleId: string) => void;
  onChatReference?: (article: Article) => void;
  onCloseChat?: () => void;
  selectedIds?: Set<string>;
  onSelect?: (article: Article) => void;
};

export default function ArticleGrid({
  articles,
  language,
  isLoading = false,
  hasMore = false,
  search = '',
  isChatOpen = false,
  onLoadMore,
  onDelete,
  onChatReference,
  onCloseChat,
  selectedIds,
  onSelect,
}: ArticleGridProps) {
  // Empty state
  if (!isLoading && articles.length === 0) {
    const isEmptyFeed = !search;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-[var(--accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isEmptyFeed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            )}
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {t(language, isEmptyFeed ? 'article.emptyFeed' : 'article.noResults')}
        </h3>
        <p className="text-sm text-[var(--text-tertiary)] text-center max-w-sm">
          {t(language, isEmptyFeed ? 'article.emptyFeedHint' : 'article.noResultsHint')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isChatOpen ? '' : 'lg:grid-cols-3'} gap-5 sm:gap-6 transition-all duration-300`}>
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            language={language}
            onDelete={onSelect ? undefined : onDelete}
            onChatReference={onSelect ? undefined : onChatReference}
            onCloseChat={onSelect ? undefined : onCloseChat}
            selected={selectedIds?.has(article.id)}
            onSelect={onSelect}
          />
        ))}

        {/* Loading skeletons */}
        {isLoading &&
          Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`skeleton-${index}`} />
          ))}
      </div>

      {/* Load More Button */}
      {hasMore && !isLoading && onLoadMore && (
        <div className="flex justify-center mt-10">
          <button
            onClick={onLoadMore}
            className="btn btn-secondary rounded-full px-6 cursor-pointer active:scale-95"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m0 0l-4-4m4 4l4-4"
              />
            </svg>
            {t(language, 'article.loadMore')}
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && articles.length > 0 && (
        <div className="flex justify-center mt-8">
          <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">{t(language, 'article.loading')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
