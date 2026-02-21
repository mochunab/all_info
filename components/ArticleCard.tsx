'use client';

import { useState, useEffect } from 'react';
import type { Article, Language } from '@/types';
import { SOURCE_COLORS, DEFAULT_SOURCE_COLOR } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';
import { getCachedTranslation, setCachedTranslation, translateTexts } from '@/lib/translation';
import { t } from '@/lib/i18n';
import ConfirmDialog from './ConfirmDialog';

type ArticleCardProps = {
  article: Article;
  language: Language;
  onDelete?: (articleId: string) => void;
};

export default function ArticleCard({ article, language, onDelete }: ArticleCardProps) {
  const sourceColor = SOURCE_COLORS[article.source_name] || DEFAULT_SOURCE_COLOR;
  const [translatedTitle, setTranslatedTitle] = useState(article.title);
  const [translatedSummary, setTranslatedSummary] = useState(article.summary || '');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 태그 3개 (ai에서 생성된 것 또는 빈 배열)
  const tags = article.summary_tags?.length > 0 ? article.summary_tags : [];

  useEffect(() => {
    // 한국어면 번역 불필요 (title_ko가 있으면 사용, 없으면 원본 title)
    if (language === 'ko') {
      setTranslatedTitle(article.title_ko || article.title);
      setTranslatedSummary(article.summary || '');
      return;
    }

    // 캐시 확인
    const cached = getCachedTranslation(article.id, language);
    if (cached) {
      setTranslatedTitle(cached.title);
      setTranslatedSummary(cached.summary || '');
      return;
    }

    // 번역 실행
    setIsTranslating(true);
    const textsToTranslate = [
      article.title,
      article.summary || '',
    ];

    translateTexts(textsToTranslate, language, 'ko')
      .then(([title, summary]) => {
        setTranslatedTitle(title);
        setTranslatedSummary(summary);
        // 캐시 저장 (ai_summary는 null로)
        setCachedTranslation(article.id, language, title, null, summary, null);
      })
      .catch((err) => {
        console.error('Translation failed:', err);
        // 실패 시 원문 유지
        setTranslatedTitle(article.title);
        setTranslatedSummary(article.summary || '');
      })
      .finally(() => {
        setIsTranslating(false);
      });
  }, [article, language]);

  const handleClick = () => {
    window.open(article.source_url, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/articles/${article.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      // 부모 컴포넌트에 삭제 완료 알림
      if (onDelete) {
        onDelete(article.id);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(t(language, 'toast.deleteFailed', { error: String(error) }));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // summary를 헤드라인과 상세 설명으로 분리
  const parseSummary = (summary: string | null) => {
    if (!summary) return { headline: '', details: '' };
    const parts = summary.split('\n\n');
    const headline = parts[0] || '';
    const details = parts.slice(1).join('\n\n') || '';
    return { headline, details };
  };

  const { headline, details } = parseSummary(translatedSummary);

  return (
    <>
      <article
        onClick={handleClick}
        className="card card-hover cursor-pointer group relative"
      >
        <div className="p-4 sm:p-5">
          {/* Top: Source Badge + External Link + Delete */}
          <div className="flex items-center justify-between mb-3">
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-white text-xs font-medium"
              style={{ backgroundColor: sourceColor }}
            >
              {article.source_name}
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Delete Button */}
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="w-7 h-7 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                title={t(language, 'dialog.deleteArticleTitle')}
              >
                <svg
                  className="w-3.5 h-3.5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              {/* External Link Button */}
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

        {/* Summary Box (structured: headline + details) */}
        {translatedSummary && (
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-3">
            {isTranslating && language !== 'ko' ? (
              <p className="text-sm text-[var(--text-secondary)]">...</p>
            ) : (
              <>
                {/* 헤드라인 (볼드, 강조) */}
                {headline && (
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-2 leading-relaxed">
                    {headline}
                  </p>
                )}
                {/* 상세 설명 (2~3문장, 전체 표시) */}
                {details && (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                    {details}
                  </p>
                )}
              </>
            )}
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

    {/* Delete Confirmation Dialog */}
    <ConfirmDialog
      isOpen={showDeleteDialog}
      title={t(language, 'dialog.deleteArticleTitle')}
      message={t(language, 'dialog.deleteArticleMessage')}
      confirmText={t(language, 'dialog.delete')}
      cancelText={t(language, 'dialog.cancel')}
      onConfirm={handleDeleteConfirm}
      onCancel={() => setShowDeleteDialog(false)}
      language={language}
      variant="danger"
    />
  </>
  );
}
