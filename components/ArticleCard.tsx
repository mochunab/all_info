'use client';

import { useState } from 'react';
import { Article, SOURCE_COLORS, DEFAULT_SOURCE_COLOR } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';

interface ArticleCardProps {
  article: Article;
}

// Check if URL needs proxy (e.g., Naver images that block hotlinking)
function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // URLs that need proxying due to hotlinking restrictions
  const needsProxy = [
    'postfiles.pstatic.net',
    'blogfiles.pstatic.net',
    'mblogthumb-phinf.pstatic.net',
  ];

  const urlNeedsProxy = needsProxy.some(domain => url.includes(domain));

  if (urlNeedsProxy) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const sourceColor = SOURCE_COLORS[article.source_name] || DEFAULT_SOURCE_COLOR;
  const thumbnailUrl = getProxiedImageUrl(article.thumbnail_url);
  const [imageError, setImageError] = useState(false);

  // AI 1줄 요약 또는 기존 summary의 첫 줄 사용
  const displaySummary =
    article.ai_summary ||
    (article.summary ? article.summary.split('\n')[0] : null);

  // 태그 3개 (ai에서 생성된 것 또는 빈 배열)
  const tags = article.summary_tags?.length > 0 ? article.summary_tags : [];

  const handleClick = () => {
    window.open(article.source_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article
      onClick={handleClick}
      className="card card-hover cursor-pointer group relative"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg-tertiary)]">
        {thumbnailUrl && !imageError ? (
          <img
            src={thumbnailUrl}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
            <svg
              className="w-12 h-12 text-[var(--text-tertiary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
          </div>
        )}

        {/* External Link Icon (visible on hover) */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md">
            <svg
              className="w-4 h-4 text-[var(--text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {/* Title */}
        <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] line-clamp-2 mb-2 group-hover:text-[var(--accent)] transition-colors">
          {article.title}
        </h3>

        {/* AI Summary - 1줄 */}
        {displaySummary && (
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
            {displaySummary}
          </p>
        )}

        {/* No summary - show content preview */}
        {!displaySummary && article.content_preview && (
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
            {article.content_preview}
          </p>
        )}

        {/* Tags - 3개 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta: Date + Source */}
        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              {article.published_at
                ? formatDistanceToNow(article.published_at)
                : formatDistanceToNow(article.crawled_at)}
            </span>
          </div>
          {/* Source Badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-white text-xs font-medium"
            style={{ backgroundColor: sourceColor }}
          >
            {article.source_name}
          </div>
        </div>
      </div>
    </article>
  );
}
