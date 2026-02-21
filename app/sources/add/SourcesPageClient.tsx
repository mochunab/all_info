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
  onRename: (newName: string) => void;
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

// SortableCategory component for drag & drop + double-click rename
function SortableCategory({ category, isActive, count, onSelect, onDelete, onRename, language }: SortableCategoryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(category);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(category);
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== category) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(category);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group flex items-center">
      <button
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
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
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent outline-none border-b border-current text-sm font-medium w-20 min-w-0"
            style={{ color: 'inherit' }}
          />
        ) : (
          <span>{category}</span>
        )}
        {count > 0 && !isEditing && (
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
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [showRecommendDialog, setShowRecommendDialog] = useState(false);
  const [recommendProgress, setRecommendProgress] = useState(0);
  const recommendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const language: Language = 'ko';

  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Focus category input
  useEffect(() => {
    if (isAddingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  const currentSources = sourcesByCategory[activeCategory] || [];

  const handleNewCategoryChange = (value: string) => {
    setNewCategory(value);
    const trimmed = value.trim();
    if (trimmed.length >= 1 && !categories.some((c) => c.name === trimmed)) {
      // 이전 pending 카테고리 정리 (소스가 비어있으면 제거)
      if (pendingCategory && pendingCategory !== trimmed) {
        const prevSources = sourcesByCategory[pendingCategory] || [];
        if (prevSources.length === 0) {
          const updated = { ...sourcesByCategory };
          delete updated[pendingCategory];
          setSourcesByCategory(updated);
        }
      }
      // 즉시 활성 카테고리로 설정 (아직 DB 저장 안 함)
      if (!sourcesByCategory[trimmed]) {
        setSourcesByCategory((prev) => ({ ...prev, [trimmed]: [] }));
      }
      setPendingCategory(trimmed);
      setActiveCategory(trimmed);
    }
  };

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
          if (!sourcesByCategory[trimmed]) {
            setSourcesByCategory({ ...sourcesByCategory, [trimmed]: [] });
          }
          setActiveCategory(trimmed);
          setPendingCategory(null);
          // 홈 화면 캐시 무효화
          try {
            sessionStorage.removeItem('ih:home:categories');
            sessionStorage.removeItem('ih:home:articles');
          } catch { /* 무시 */ }
        } else if (response.status === 409) {
          setToastMessage(t(language, 'sources.categoryExists', { name: trimmed }));
          setShowToast(true);
        } else {
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
      if (pendingCategory) {
        const prevSources = sourcesByCategory[pendingCategory] || [];
        if (prevSources.length === 0) {
          setSourcesByCategory((prev) => {
            const updated = { ...prev };
            delete updated[pendingCategory];
            return updated;
          });
        }
        if (categories.length > 0) {
          setActiveCategory(categories[0].name);
        }
        setPendingCategory(null);
      }
      setIsAddingCategory(false);
      setNewCategory('');
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
      });

      if (response.ok) {
        // 로컬 상태 업데이트
        setCategories((prev) =>
          prev.map((c) => (c.name === oldName ? { ...c, name: newName } : c))
        );
        setSourcesByCategory((prev) => {
          const updated = { ...prev };
          if (updated[oldName]) {
            updated[newName] = updated[oldName];
            delete updated[oldName];
          }
          return updated;
        });
        if (activeCategory === oldName) {
          setActiveCategory(newName);
        }
        // 홈 화면 캐시 무효화
        try {
          sessionStorage.removeItem('ih:home:categories');
          sessionStorage.removeItem('ih:home:articles');
        } catch { /* 무시 */ }
      } else if (response.status === 409) {
        setToastMessage(t(language, 'sources.categoryExists', { name: newName }));
        setShowToast(true);
      } else {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        setToastMessage(t(language, 'toast.error', { error: data.error || `HTTP ${response.status}` }));
        setShowToast(true);
      }
    } catch (err) {
      console.error('Error renaming category:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setToastMessage(t(language, 'toast.networkError', { error: msg }));
      setShowToast(true);
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
        // 홈 화면 캐시 무효화
        try {
          sessionStorage.removeItem('ih:home:categories');
          sessionStorage.removeItem('ih:home:articles');
        } catch { /* 무시 */ }
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

  const startAnalysisProgress = () => {
    setAnalysisProgress(0);
    setShowAnalysisDialog(true);

    const INTERVAL = 200;
    let elapsed = 0;

    analysisTimerRef.current = setInterval(() => {
      elapsed += INTERVAL;

      // 0~25초: 0% → 95% (일정 속도)
      // 25~30초: 95% → 99% (천천히)
      let progress: number;
      if (elapsed <= 25000) {
        progress = (elapsed / 25000) * 95;
      } else {
        progress = 95 + ((elapsed - 25000) / 5000) * 4;
      }

      progress = Math.min(progress, 99);
      setAnalysisProgress(progress);

      if (progress >= 99) {
        clearInterval(analysisTimerRef.current!);
        analysisTimerRef.current = null;
      }
    }, INTERVAL);
  };

  const stopAnalysisProgress = (success: boolean) => {
    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    if (success) {
      setAnalysisProgress(100);
      setTimeout(() => {
        setShowAnalysisDialog(false);
        setAnalysisProgress(0);
      }, 600);
    } else {
      setShowAnalysisDialog(false);
      setAnalysisProgress(0);
    }
  };

  const startRecommendProgress = () => {
    setRecommendProgress(0);
    setShowRecommendDialog(true);

    const INTERVAL = 200;
    let elapsed = 0;

    recommendTimerRef.current = setInterval(() => {
      elapsed += INTERVAL;

      // 0~15초: 0% → 90%, 15~20초: 90% → 99%
      let progress: number;
      if (elapsed <= 15000) {
        progress = (elapsed / 15000) * 90;
      } else {
        progress = 90 + ((elapsed - 15000) / 5000) * 9;
      }

      progress = Math.min(progress, 99);
      setRecommendProgress(progress);

      if (progress >= 99) {
        clearInterval(recommendTimerRef.current!);
        recommendTimerRef.current = null;
      }
    }, INTERVAL);
  };

  const stopRecommendProgress = (success: boolean) => {
    if (recommendTimerRef.current) {
      clearInterval(recommendTimerRef.current);
      recommendTimerRef.current = null;
    }
    if (success) {
      setRecommendProgress(100);
      setTimeout(() => {
        setShowRecommendDialog(false);
        setRecommendProgress(0);
      }, 600);
    } else {
      setShowRecommendDialog(false);
      setRecommendProgress(0);
    }
  };

  const handleRecommendSources = async (scope: 'domestic' | 'international' | 'both') => {
    setShowScopeDialog(false);
    startRecommendProgress();

    try {
      const response = await fetch('/api/sources/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: activeCategory, scope }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.recommendations?.length > 0) {
        stopRecommendProgress(true);

        const newLinks: SourceLink[] = data.recommendations.map(
          (rec: { url: string; name: string; description: string }, i: number) => ({
            id: `new-rec-${Date.now()}-${i}`,
            url: rec.url,
            name: rec.name,
            crawlerType: 'AUTO',
            isExisting: false,
          })
        );

        setSourcesByCategory((prev) => ({
          ...prev,
          [activeCategory]: [...(prev[activeCategory] || []), ...newLinks],
        }));

        setToastMessage(t(language, 'sources.recommendSuccess', { count: String(newLinks.length) }));
        setShowToast(true);
      } else if (response.ok && data.success && (!data.recommendations || data.recommendations.length === 0)) {
        stopRecommendProgress(false);
        setToastMessage(t(language, 'sources.recommendEmpty'));
        setShowToast(true);
      } else {
        stopRecommendProgress(false);
        setToastMessage(t(language, 'sources.recommendFailed', { error: data.error || `HTTP ${response.status}` }));
        setShowToast(true);
      }
    } catch (error) {
      stopRecommendProgress(false);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setToastMessage(t(language, 'sources.recommendFailed', { error: msg }));
      setShowToast(true);
    }
  };

  const handleSave = async () => {
    // pending 카테고리가 있으면 먼저 DB에 생성
    if (pendingCategory && !categories.some((c) => c.name === pendingCategory)) {
      try {
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: pendingCategory }),
        });

        if (response.ok) {
          const data = await response.json();
          const newCat: Category = data.category || { id: Date.now(), name: pendingCategory, is_default: false };
          setCategories((prev) => [...prev, newCat]);
        } else if (response.status !== 409) {
          const data = await response.json().catch(() => ({ error: 'Unknown error' }));
          setToastMessage(t(language, 'toast.error', { error: data.error || `HTTP ${response.status}` }));
          setShowToast(true);
          return;
        }
      } catch (err) {
        console.error('Error saving pending category:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setToastMessage(t(language, 'toast.networkError', { error: msg }));
        setShowToast(true);
        return;
      }
      setPendingCategory(null);
      setNewCategory('');
      setIsAddingCategory(false);
    }

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

    // 신규 소스 또는 AUTO 타입이 있을 때만 분석 다이얼로그 표시
    const needsAnalysis = Object.values(sourcesByCategory).some((sources) =>
      sources.some((s) => s.url.trim() && (!s.isExisting || s.crawlerType === 'AUTO'))
    );

    setIsSaving(true);
    if (needsAnalysis) {
      startAnalysisProgress();
    }
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
        stopAnalysisProgress(true);

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
        // 분석 결과로 크롤러 타입 UI 업데이트
        if (data.analysis && data.analysis.length > 0) {
          setSourcesByCategory((prev) => {
            const updated = { ...prev };
            for (const [cat, sources] of Object.entries(updated)) {
              updated[cat] = (sources as SourceLink[]).map((s) => {
                const match = data.analysis.find(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (a: any) => a.url === s.url && a.crawlerType
                );
                if (match) {
                  return { ...s, crawlerType: match.crawlerType, isExisting: true };
                }
                return s;
              });
            }
            return updated;
          });
        }

        setPendingDeleteIds([]);
        setToastMessage(message);
        setShowToast(true);

        // RSC 캐시 무효화 (페이지에 머무르며 데이터 갱신)
        router.refresh();
      } else {
        stopAnalysisProgress(false);
        const detail = data.error || `HTTP ${response.status}`;
        setToastMessage(t(language, 'toast.crawlFailed', { error: detail }));
        setShowToast(true);
      }
    } catch (error) {
      stopAnalysisProgress(false);
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
                    onRename={(newName) => handleRenameCategory(cat.name, newName)}
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
                  onChange={(e) => handleNewCategoryChange(e.target.value)}
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
                    // pending 카테고리 정리 (소스가 비어있으면 제거)
                    if (pendingCategory) {
                      const prevSources = sourcesByCategory[pendingCategory] || [];
                      if (prevSources.length === 0) {
                        setSourcesByCategory((prev) => {
                          const updated = { ...prev };
                          delete updated[pendingCategory];
                          return updated;
                        });
                      }
                      // 기존 카테고리로 복귀
                      if (categories.length > 0) {
                        setActiveCategory(categories[0].name);
                      }
                      setPendingCategory(null);
                    }
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {t(language, 'sources.linkLabel')}
              </label>
              <button
                onClick={() => setShowScopeDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 rounded-full hover:bg-[var(--accent)]/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                {t(language, 'sources.recommendLink')}
              </button>
            </div>
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

      {/* Analysis Progress Dialog */}
      {showAnalysisDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-primary)] rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    크롤링 전략 분석 중
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    AI가 최적의 크롤링 방식을 찾고 있어요
                  </p>
                </div>
              </div>
              <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-2 text-right">
                {Math.round(analysisProgress)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scope Selection Dialog */}
      {showScopeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-primary)] rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {t(language, 'sources.recommendScope')}
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleRecommendSources('domestic')}
                  className="w-full py-3 px-4 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-left"
                >
                  {t(language, 'sources.scopeDomestic')}
                </button>
                <button
                  onClick={() => handleRecommendSources('international')}
                  className="w-full py-3 px-4 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-left"
                >
                  {t(language, 'sources.scopeInternational')}
                </button>
                <button
                  onClick={() => handleRecommendSources('both')}
                  className="w-full py-3 px-4 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-left"
                >
                  {t(language, 'sources.scopeBoth')}
                </button>
              </div>
            </div>
            <div className="border-t border-[var(--border)]">
              <button
                onClick={() => setShowScopeDialog(false)}
                className="w-full py-3.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                {t(language, 'sources.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommend Loading Dialog */}
      {showRecommendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-primary)] rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {t(language, 'sources.recommendLoading')}
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {t(language, 'sources.recommendLoadingDesc')}
                  </p>
                </div>
              </div>
              <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${recommendProgress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-2 text-right">
                {Math.round(recommendProgress)}%
              </p>
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
