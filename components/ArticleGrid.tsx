'use client';

import type { Article, Language } from '@/types';
import ArticleCard from './ArticleCard';
import Skeleton from './Skeleton';

interface ArticleGridProps {
  articles: Article[];
  language: Language;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function ArticleGrid({
  articles,
  language,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}: ArticleGridProps) {
  // Empty state
  if (!isLoading && articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          검색 결과가 없습니다
        </h3>
        <p className="text-sm text-[var(--text-tertiary)] text-center max-w-sm">
          다른 키워드로 검색하거나 필터를 변경해보세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} language={language} />
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
            className="btn btn-secondary"
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
            더 보기
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
            <span className="text-sm">로딩 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}
