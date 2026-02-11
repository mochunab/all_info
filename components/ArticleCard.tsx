'use client';

import { useState, useEffect } from 'react';
import type { Article, Language } from '@/types';
import { SOURCE_COLORS, DEFAULT_SOURCE_COLOR } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';
import { getCachedTranslation, setCachedTranslation, translateTexts } from '@/lib/translation';
import { t } from '@/lib/i18n';

type ArticleCardProps = {
  article: Article;
  language: Language;
};

export default function ArticleCard({ article, language }: ArticleCardProps) {
  const sourceColor = SOURCE_COLORS[article.source_name] || DEFAULT_SOURCE_COLOR;
  const [translatedTitle, setTranslatedTitle] = useState(article.title);
  const [translatedSummary, setTranslatedSummary] = useState(article.ai_summary || article.content_preview);
  const [isTranslating, setIsTranslating] = useState(false);

  // 태그 3개 (ai에서 생성된 것 또는 빈 배열)
  const tags = article.summary_tags?.length > 0 ? article.summary_tags : [];

  useEffect(() => {
    // 한국어면 번역 불필요
    if (language === 'ko') {
      setTranslatedTitle(article.title);
      setTranslatedSummary(article.ai_summary || article.content_preview);
      return;
    }

    // 캐시 확인
    const cached = getCachedTranslation(article.id, language);
    if (cached) {
      setTranslatedTitle(cached.title);
      setTranslatedSummary(cached.ai_summary || cached.content_preview);
      return;
    }

    // 번역 실행
    setIsTranslating(true);
    const textsToTranslate = [
      article.title,
      article.ai_summary || article.content_preview || '',
    ];

    translateTexts(textsToTranslate, language, 'ko')
      .then(([title, summary]) => {
        setTranslatedTitle(title);
        setTranslatedSummary(summary);
        // 캐시 저장
        setCachedTranslation(article.id, language, title, summary, null);
      })
      .catch((err) => {
        console.error('Translation failed:', err);
        // 실패 시 원문 유지
        setTranslatedTitle(article.title);
        setTranslatedSummary(article.ai_summary || article.content_preview);
      })
      .finally(() => {
        setIsTranslating(false);
      });
  }, [article, language]);

  const handleClick = () => {
    window.open(article.source_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article
      onClick={handleClick}
      className="card card-hover cursor-pointer group relative"
    >
      <div className="p-4 sm:p-5">
        {/* Top: Source Badge + External Link */}
        <div className="flex items-center justify-between mb-3">
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-white text-xs font-medium"
            style={{ backgroundColor: sourceColor }}
          >
            {article.source_name}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-7 h-7 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-[var(--text-secondary)]"
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

        {/* Title (with translation loading indicator) */}
        <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] line-clamp-2 mb-3 group-hover:text-[var(--accent)] transition-colors">
          {isTranslating && language !== 'ko' ? (
            <span className="text-[var(--text-tertiary)] italic">{t(language, 'article.translating')}</span>
          ) : (
            translatedTitle
          )}
        </h3>

        {/* Summary Box */}
        {translatedSummary && (
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-3">
            <p className="text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
              {isTranslating && language !== 'ko' ? '...' : translatedSummary}
            </p>
          </div>
        )}

        {/* Tags */}
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

        {/* Date */}
        <div className="flex items-center text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border)]">
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
        </div>
      </div>
    </article>
  );
}
