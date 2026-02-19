'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toast } from '@/components';
import type { Language } from '@/types';
import { t } from '@/lib/i18n';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type SourceLink = {
  id: string;
  url: string;
  name: string;
  crawlerType: string;
  isExisting: boolean;
};

type Category = {
  id: number;
  name: string;
  is_default: boolean;
};

type SortableCategoryProps = {
  category: string;
  isActive: boolean;
  count: number;
  onSelect: () => void;
  onDelete: () => void;
  language: Language;
};

const getCrawlerTypeLabel = (type: string, language: Language): string => {
  const labels: Record<string, Record<Language, string>> = {
    AUTO: { ko: '자동지정', en: 'Auto-detect', ja: '自動検出', zh: '自动检测' },
    STATIC: { ko: '정적페이지', en: 'Static', ja: '静的', zh: '静态' },
    SPA: { ko: 'SPA (동적)', en: 'SPA (Dynamic)', ja: 'SPA (動的)', zh: 'SPA (动态)' },
    RSS: { ko: 'RSS 피드', en: 'RSS Feed', ja: 'RSSフィード', zh: 'RSS订阅' },
    SITEMAP: { ko: 'Sitemap', en: 'Sitemap', ja: 'サイトマップ', zh: '网站地图' },
    PLATFORM_NAVER: { ko: '네이버 블로그', en: 'Naver Blog', ja: 'Naverブログ', zh: 'Naver博客' },
    PLATFORM_KAKAO: { ko: '카카오 브런치', en: 'Kakao Brunch', ja: 'Kakaoブランチ', zh: 'Kakao Brunch' },
    NEWSLETTER: { ko: '뉴스레터', en: 'Newsletter', ja: 'ニュースレター', zh: '新闻订阅' },
    API: { ko: 'API', en: 'API', ja: 'API', zh: 'API' },
  };
  return labels[type]?.[language] || type;
};

const CRAWLER_TYPES = [
  'AUTO',
  'STATIC',
  'SPA',
  'RSS',
  'SITEMAP',
  'PLATFORM_NAVER',
  'PLATFORM_KAKAO',
  'NEWSLETTER',
  'API',
] as const;

// SortableCategory component for drag & drop
function SortableCategory({ category, isActive, count, onSelect, onDelete, language }: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group flex items-center">
      <button
        onClick={onSelect}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
          isActive
            ? 'bg-[var(--accent)] text-white'
            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
        }`}
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
          title={language === 'ko' ? '드래그하여 순서 변경' : language === 'en' ? 'Drag to reorder' : language === 'ja' ? 'ドラッグして並び替え' : '拖动以重新排序'}
        >
          <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </span>
        <span>{category}</span>
        {count > 0 && (
          <span className={`text-xs ${
            isActive ? 'text-white/70' : 'text-[var(--text-tertiary)]'
          }`}>
            {count}
          </span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-tertiary)] hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

type SourcesPageClientProps = {
  initialCategories: Category[];
  initialSourcesByCategory: Record<string, SourceLink[]>;
  initialActiveCategory: string;
};

export default function SourcesPageClient({
  initialCategories,
  initialSourcesByCategory,
  initialActiveCategory,
}: SourcesPageClientProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [activeCategory, setActiveCategory] = useState(initialActiveCategory);
  const [sourcesByCategory, setSourcesByCategory] = useState<Record<string, SourceLink[]>>(initialSourcesByCategory);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const language: Language = 'ko';

  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Focus category input
  useEffect(() => {
    if (isAddingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  const currentSources = sourcesByCategory[activeCategory] || [];

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.some((c) => c.name === trimmed)) {
      try {
        // DB에 카테고리 저장
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });

        if (response.ok) {
          const data = await response.json();
          const newCat: Category = data.category || { id: Date.now(), name: trimmed, is_default: false };
          setCategories([...categories, newCat]);
          setSourcesByCategory({ ...sourcesByCategory, [trimmed]: [] });
          setActiveCategory(trimmed);
        } else if (response.status === 409) {
          // 이미 존재하는 카테고리
          setToastMessage(t(language, 'sources.categoryExists', { name: trimmed }));
          setShowToast(true);
        } else {
          // 기타 에러
          const data = await response.json().catch(() => ({ error: 'Unknown error' }));
          setToastMessage(t(language, 'toast.error', { error: data.error || `HTTP ${response.status}` }));
          setShowToast(true);
        }
      } catch (err) {
        console.error('Error saving category:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setToastMessage(t(language, 'toast.networkError', { error: msg }));
        setShowToast(true);
      }

      setNewCategory('');
      setIsAddingCategory(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((cat) => cat.name === active.id);
    const newIndex = categories.findIndex((cat) => cat.name === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    // API 호출하여 순서 저장
    try {
      await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: newCategories.map((cat) => ({ id: cat.id, name: cat.name })),
        }),
      });
    } catch (error) {
      console.error('Error reordering categories:', error);
      // 실패 시 원래 순서로 되돌림
      const originalOrder = arrayMove(newCategories, newIndex, oldIndex);
      setCategories(originalOrder);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCategory();
    } else if (e.key === 'Escape') {
      setIsAddingCategory(false);
      setNewCategory('');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deletingCategory }),
      });

      if (response.ok) {
        const newCategories = categories.filter((c) => c.name !== deletingCategory);
        const newSourcesByCategory = { ...sourcesByCategory };
        delete newSourcesByCategory[deletingCategory];

        setCategories(newCategories);
        setSourcesByCategory(newSourcesByCategory);

        if (activeCategory === deletingCategory) {
          setActiveCategory(newCategories[0]?.name || '');
        }

        setToastMessage(t(language, 'sources.categoryDeleted', { name: deletingCategory }));
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    } finally {
      setIsDeleting(false);
      setDeletingCategory(null);
    }
  };

  const handleSourceChange = (id: string, field: 'url' | 'name' | 'crawlerType', value: string) => {
    setSourcesByCategory({
      ...sourcesByCategory,
      [activeCategory]: currentSources.map((s) => {
        if (s.id !== id) return s;
        // 기존 소스의 URL 변경 시 → 기존 소스는 삭제 대상에 추가, 새 소스로 전환
        if (field === 'url' && s.isExisting) {
          setPendingDeleteIds((prev) => [...prev, parseInt(s.id, 10)]);
          return { ...s, [field]: value, isExisting: false, id: `new-${Date.now()}` };
        }
        return { ...s, [field]: value };
      }),
    });
  };

  const handleAddLink = () => {
    setSourcesByCategory({
      ...sourcesByCategory,
      [activeCategory]: [
        ...currentSources,
        { id: `new-${Date.now()}`, url: '', name: '', crawlerType: 'AUTO', isExisting: false },
      ],
    });
  };

  const handleRemoveLink = (id: string) => {
    const target = currentSources.find((s) => s.id === id);
    if (target?.isExisting) {
      setPendingDeleteIds((prev) => [...prev, parseInt(target.id, 10)]);
    }
    setSourcesByCategory({
      ...sourcesByCategory,
      [activeCategory]: currentSources.filter((s) => s.id !== id),
    });
  };

  const handleSave = async () => {
    // Collect all valid sources from all categories
    const allSources: { url: string; name: string; category: string; crawlerType: string }[] = [];
    for (const [cat, sources] of Object.entries(sourcesByCategory)) {
      for (const s of sources) {
        if (s.url.trim()) {
          allSources.push({
            url: s.url.trim(),
            name: s.name.trim() || extractDomainName(s.url),
            category: cat,
            crawlerType: s.crawlerType,
          });
        }
      }
    }

    if (allSources.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: allSources,
          ...(pendingDeleteIds.length > 0 && { deleteIds: pendingDeleteIds }),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 분석 결과를 토스트 메시지에 포함
        let message = t(language, 'sources.saved');
        if (data.analysis && data.analysis.length > 0) {
          const ruleCount = data.analysis.filter((a: { method: string }) => a.method === 'rule').length;
          const aiCount = data.analysis.filter((a: { method: string }) => a.method === 'ai').length;
          const parts: string[] = [];
          if (ruleCount > 0) parts.push(`${ruleCount} rule`);
          if (aiCount > 0) parts.push(`${aiCount} AI`);
          if (parts.length > 0) {
            message = t(language, 'sources.autoAnalysis', {
              count: String(data.sources?.length || allSources.length),
              methods: parts.join(' / '),
            });
          }
        }
        setPendingDeleteIds([]);
        setToastMessage(message);
        setShowToast(true);

        // RSC 캐시 무효화
        router.refresh();

        setTimeout(() => {
          router.push('/');
        }, 2200);
      } else {
        const detail = data.error || `HTTP ${response.status}`;
        setToastMessage(t(language, 'toast.crawlFailed', { error: detail }));
        setShowToast(true);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setToastMessage(t(language, 'toast.networkError', { error: msg }));
      setShowToast(true);
      console.error('Error saving sources:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const extractDomainName = (url: string): string => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain.split('.')[0];
    } catch {
      return url;
    }
  };

  const hasValidSources = Object.values(sourcesByCategory).some((sources) =>
    sources.some((s) => s.url.trim())
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span>{t(language, 'sources.back')}</span>
            </Link>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {t(language, 'sources.title')}
        </h1>
        <p className="text-sm text-[var(--text-tertiary)] mb-8">
          {t(language, 'sources.subtitle')}
        </p>

        {/* Category Tabs (Chips) with Drag & Drop */}
        <div className="mb-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map((cat) => cat.name)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((cat) => (
                  <SortableCategory
                    key={cat.name}
                    category={cat.name}
                    isActive={activeCategory === cat.name}
                    count={sourcesByCategory[cat.name]?.length || 0}
                    onSelect={() => setActiveCategory(cat.name)}
                    onDelete={() => setDeletingCategory(cat.name)}
                    language={language}
                  />
                ))}

            {/* Add Category Button / Input */}
            {isAddingCategory ? (
              <div className="flex items-center gap-2">
                <input
                  ref={categoryInputRef}
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={handleCategoryKeyDown}
                  placeholder={
                    language === 'ko' ? '분류명 입력...' :
                    language === 'en' ? 'Enter category...' :
                    language === 'ja' ? 'カテゴリ名を入力...' :
                    '输入类别...'
                  }
                  className="px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--accent)] rounded-full focus:outline-none w-32"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-3 py-2 text-xs font-medium bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-hover)]"
                >
                  {language === 'ko' ? '추가' : language === 'en' ? 'Add' : language === 'ja' ? '追加' : '添加'}
                </button>
                <button
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategory('');
                  }}
                  className="px-3 py-2 text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-full border border-[var(--border)]"
                >
                  {t(language, 'sources.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingCategory(true)}
                className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-[var(--accent)] bg-[var(--bg-secondary)] border border-dashed border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Source Links for Active Category */}
        {activeCategory && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              {t(language, 'sources.linkLabel')}
            </label>
            <div className="space-y-3">
              {currentSources.map((source) => (
                <div key={source.id} className="relative">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={source.url}
                      onChange={(e) => handleSourceChange(source.id, 'url', e.target.value)}
                      placeholder={t(language, 'sources.urlPlaceholder')}
                      className="flex-1 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <button
                      onClick={() => handleRemoveLink(source.id)}
                      className="px-3 py-3 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
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
                  </div>
                  {source.url && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={source.name}
                        onChange={(e) => handleSourceChange(source.id, 'name', e.target.value)}
                        placeholder={t(language, 'sources.namePlaceholder')}
                        className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                      <select
                        value={source.crawlerType}
                        onChange={(e) => handleSourceChange(source.id, 'crawlerType', e.target.value)}
                        className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                      >
                        {CRAWLER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {getCrawlerTypeLabel(type, language)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Link Button */}
            <button
              onClick={handleAddLink}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>{t(language, 'sources.addLink')}</span>
            </button>
          </div>
        )}
      </main>

      {/* Bottom Sticky Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border)] p-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSave}
            disabled={!hasValidSources || isSaving}
            className="w-full py-4 bg-[var(--accent)] text-white text-base font-semibold rounded-xl hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? t(language, 'sources.saving') : t(language, 'sources.save')}
          </button>
        </div>
      </div>

      {/* Delete Category Confirmation Dialog */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-primary)] rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {t(language, 'sources.deleteCategory')}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t(language, 'sources.deleteCategoryConfirm', { name: deletingCategory })}
              </p>
              {(sourcesByCategory[deletingCategory]?.filter((s) => s.isExisting).length || 0) > 0 && (
                <p className="mt-2 text-sm text-red-500">
                  {t(language, 'sources.deleteWithLinks', {
                    count: String(sourcesByCategory[deletingCategory].filter((s) => s.isExisting).length),
                  })}
                </p>
              )}
            </div>
            <div className="flex border-t border-[var(--border)]">
              <button
                onClick={() => setDeletingCategory(null)}
                disabled={isDeleting}
                className="flex-1 py-3.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                {t(language, 'sources.cancel')}
              </button>
              <div className="w-px bg-[var(--border)]" />
              <button
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                className="flex-1 py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isDeleting ? t(language, 'sources.deleting') : t(language, 'sources.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2200}
      />
    </div>
  );
}
