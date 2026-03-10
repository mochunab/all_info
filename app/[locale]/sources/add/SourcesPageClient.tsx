'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { event as gaEvent } from '@/lib/gtag';
import { Toast, LoginPromptDialog } from '@/components';
import type { Language } from '@/types';
import { useLanguage } from '@/lib/language-context';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
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
  translations?: Record<string, string>;
};

type SortableCategoryProps = {
  category: string;
  isActive: boolean;
  count: number;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  language: Language;
  readOnly?: boolean;
};

const getCrawlerTypeLabel = (type: string, language: Language): string => {
  const labels: Record<string, Record<Language, string>> = {
    AUTO: { ko: '자동지정', en: 'Auto-detect', vi: 'Tự động', zh: '自动检测', ja: '自動検出' },
    STATIC: { ko: '정적페이지', en: 'Static', vi: 'Tĩnh', zh: '静态', ja: '静的' },
    SPA: { ko: 'SPA (동적)', en: 'SPA (Dynamic)', vi: 'SPA (Động)', zh: 'SPA (动态)', ja: 'SPA (動的)' },
    RSS: { ko: 'RSS 피드', en: 'RSS Feed', vi: 'RSS Feed', zh: 'RSS订阅', ja: 'RSSフィード' },
    SITEMAP: { ko: 'Sitemap', en: 'Sitemap', vi: 'Sitemap', zh: '网站地图', ja: 'サイトマップ' },
    PLATFORM_NAVER: { ko: '네이버 블로그', en: 'Naver Blog', vi: 'Naver Blog', zh: 'Naver博客', ja: 'Naverブログ' },
    PLATFORM_KAKAO: { ko: '카카오 브런치', en: 'Kakao Brunch', vi: 'Kakao Brunch', zh: 'Kakao Brunch', ja: 'Kakaoブランチ' },
    NEWSLETTER: { ko: '뉴스레터', en: 'Newsletter', vi: 'Bản tin', zh: '新闻订阅', ja: 'ニュースレター' },
    API: { ko: 'API', en: 'API', vi: 'API', zh: 'API', ja: 'API' },
  };
  return labels[type]?.[language] || type;
};

const MAX_LINKS_PER_CATEGORY = 10;
const MAX_CATEGORIES = 20;

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
function SortableCategory({ category, isActive, count, onSelect, onDelete, onRename, language, readOnly }: SortableCategoryProps) {
  const { translateCat } = useLanguage();
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
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer ${
          isActive
            ? 'bg-[var(--accent)] text-white shadow-sm'
            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
        }`}
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
          title={language === 'ko' ? '드래그하여 순서 변경' : language === 'en' ? 'Drag to reorder' : language === 'vi' ? 'Kéo để sắp xếp lại' : language === 'zh' ? '拖动以重新排序' : 'ドラッグして並び替え'}
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
          <span>{translateCat(category)}</span>
        )}
        {count > 0 && !isEditing && (
          <span className={`text-xs ${
            isActive ? 'text-white/70' : 'text-[var(--text-tertiary)]'
          }`}>
            {count}
          </span>
        )}
      </button>
      {!readOnly && (
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
      )}
    </div>
  );
}

type SourcesPageClientProps = {
  initialCategories: Category[];
  initialSourcesByCategory: Record<string, SourceLink[]>;
  initialActiveCategory: string;
  readOnly?: boolean;
};

export default function SourcesPageClient({
  initialCategories,
  initialSourcesByCategory,
  initialActiveCategory,
  readOnly = false,
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
  const [isDeleting] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [showRecommendDialog, setShowRecommendDialog] = useState(false);
  const [recommendProgress, setRecommendProgress] = useState(0);
  const recommendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showBotBlockedDialog, setShowBotBlockedDialog] = useState(false);
  const [pendingRenames, setPendingRenames] = useState<{ oldName: string; newName: string }[]>([]);
  const [pendingCategoryDeletes, setPendingCategoryDeletes] = useState<string[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);
  const [showBrowseMaster, setShowBrowseMaster] = useState(false);
  const [masterData, setMasterData] = useState<{ categories: Category[]; sourcesByCategory: Record<string, SourceLink[]> } | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [selectedMasterCats, setSelectedMasterCats] = useState<Set<string>>(new Set());
  const [expandedMasterCats, setExpandedMasterCats] = useState<Set<string>>(new Set());
  const { language, t, translateCat, setCategoryTranslations } = useLanguage();

  const categoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCategoryTranslations(initialCategories);
  }, [initialCategories, setCategoryTranslations]);

  // Focus category input
  useEffect(() => {
    if (isAddingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  const currentSources = sourcesByCategory[activeCategory] || [];

  const fetchMasterCategories = useCallback(async () => {
    setMasterLoading(true);
    try {
      const [catRes, srcRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/sources'),
      ]);
      const catData = await catRes.json();
      const srcData = await srcRes.json();
      const cats: Category[] = catData.categories || [];
      const grouped: Record<string, SourceLink[]> = {};
      for (const cat of cats) {
        grouped[cat.name] = [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of (srcData.sources || []) as any[]) {
        const srcCat = s.config?.category || (cats[0]?.name || '');
        if (grouped[srcCat]) {
          grouped[srcCat].push({
            id: s.id.toString(),
            url: s.base_url,
            name: s.name,
            crawlerType: s.crawler_type || 'AUTO',
            isExisting: true,
          });
        }
      }
      setMasterData({ categories: cats, sourcesByCategory: grouped });
      setCategoryTranslations(cats);
    } catch {
      setMasterData({ categories: [], sourcesByCategory: {} });
    } finally {
      setMasterLoading(false);
    }
  }, [setCategoryTranslations]);

  const handleOpenBrowseMaster = useCallback(() => {
    setShowBrowseMaster(true);
    setSelectedMasterCats(new Set());
    setExpandedMasterCats(new Set());
    if (!masterData) {
      fetchMasterCategories();
    }
  }, [fetchMasterCategories, masterData]);

  const handleAddMasterCategories = useCallback(() => {
    if (!masterData || selectedMasterCats.size === 0) return;
    const newCats = [...categories];
    const newGrouped = { ...sourcesByCategory };
    let added = 0;
    for (const catName of selectedMasterCats) {
      if (categories.some((c) => c.name === catName)) continue;
      if (newCats.length >= MAX_CATEGORIES) break;
      const masterCat = masterData.categories.find((c) => c.name === catName);
      newCats.push(masterCat || { id: Date.now() + added, name: catName, is_default: false });
      newGrouped[catName] = (masterData.sourcesByCategory[catName] || []).map((s) => ({
        ...s,
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        isExisting: false,
      }));
      added++;
    }
    setCategories(newCats);
    setSourcesByCategory(newGrouped);
    if (added > 0 && !activeCategory) {
      setActiveCategory(newCats[0].name);
    }
    setShowBrowseMaster(false);
    setToastMessage(t('sources.browseMasterAdded', { count: String(added) }));
    setShowToast(true);
  }, [masterData, selectedMasterCats, categories, sourcesByCategory, activeCategory, t]);

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

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.some((c) => c.name === trimmed)) {
      const newCat: Category = { id: Date.now(), name: trimmed, is_default: false };
      setCategories([...categories, newCat]);
      if (!sourcesByCategory[trimmed]) {
        setSourcesByCategory({ ...sourcesByCategory, [trimmed]: [] });
      }
      setActiveCategory(trimmed);
      setPendingCategory(null);
    } else if (trimmed && categories.some((c) => c.name === trimmed)) {
      setToastMessage(t('sources.categoryExists', { name: trimmed }));
      setShowToast(true);
    }
    setNewCategory('');
    setIsAddingCategory(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
    setOrderChanged(true);
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

  const handleRenameCategory = (oldName: string, newName: string) => {
    // 로컬 중복 체크
    if (categories.some((c) => c.name === newName && c.name !== oldName)) {
      setToastMessage(t('sources.categoryExists', { name: newName }));
      setShowToast(true);
      return;
    }

    // 로컬 상태만 업데이트, 저장 시 API 호출
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

    // pending 목록에 추가 (이전 rename과 체이닝)
    setPendingRenames((prev) => {
      const existing = prev.find((r) => r.newName === oldName);
      if (existing) {
        return prev.map((r) => (r.newName === oldName ? { ...r, newName } : r));
      }
      return [...prev, { oldName, newName }];
    });
  };

  const handleDeleteCategory = () => {
    if (!deletingCategory) return;

    const catToDelete = categories.find((c) => c.name === deletingCategory);
    const newCategories = categories.filter((c) => c.name !== deletingCategory);
    const newSourcesByCategory = { ...sourcesByCategory };
    // 기존 소스의 ID를 삭제 대상에 추가
    const existingSources = (sourcesByCategory[deletingCategory] || []).filter((s) => s.isExisting);
    if (existingSources.length > 0) {
      setPendingDeleteIds((prev) => [...prev, ...existingSources.map((s) => parseInt(s.id, 10))]);
    }
    delete newSourcesByCategory[deletingCategory];

    setCategories(newCategories);
    setSourcesByCategory(newSourcesByCategory);

    if (activeCategory === deletingCategory) {
      setActiveCategory(newCategories[0]?.name || '');
    }

    // DB에 존재하는 카테고리면 삭제 대기열에 추가
    if (catToDelete && initialCategories.some((ic) => ic.name === catToDelete.name)) {
      setPendingCategoryDeletes((prev) => [...prev, deletingCategory]);
    }

    setDeletingCategory(null);
  };

  const handleSourceChange = (id: string, field: 'url' | 'name' | 'crawlerType', value: string) => {
    setSourcesByCategory({
      ...sourcesByCategory,
      [activeCategory]: currentSources.map((s) => {
        if (s.id !== id) return s;
        // 기존 소스의 URL 변경 시 → 기존 소스는 삭제 대상에 추가, 새 소스로 전환
        if (field === 'url' && s.isExisting) {
          setPendingDeleteIds((prev) => [...prev, parseInt(s.id, 10)]);
          return { ...s, url: value, name: '', crawlerType: 'AUTO', isExisting: false, id: `new-${Date.now()}` };
        }
        return { ...s, [field]: value };
      }),
    });
  };

  const handleAddLink = () => {
    if (currentSources.length >= MAX_LINKS_PER_CATEGORY) {
      setToastMessage(t('sources.maxLinksReached', { max: String(MAX_LINKS_PER_CATEGORY) }));
      setShowToast(true);
      return;
    }
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
    gaEvent({ action: 'recommend_sources', category: 'source', label: scope });
    setShowScopeDialog(false);

    const currentCount = (sourcesByCategory[activeCategory] || []).length;
    if (currentCount >= MAX_LINKS_PER_CATEGORY) {
      setToastMessage(t('sources.maxLinksReached', { max: String(MAX_LINKS_PER_CATEGORY) }));
      setShowToast(true);
      return;
    }

    const remainingSlots = MAX_LINKS_PER_CATEGORY - currentCount;
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

        const allRecs: SourceLink[] = data.recommendations.map(
          (rec: { url: string; name: string; description: string }, i: number) => ({
            id: `new-rec-${Date.now()}-${i}`,
            url: rec.url,
            name: rec.name,
            crawlerType: 'AUTO',
            isExisting: false,
          })
        );

        const newLinks = allRecs.slice(0, remainingSlots);

        setSourcesByCategory((prev) => ({
          ...prev,
          [activeCategory]: [...(prev[activeCategory] || []), ...newLinks],
        }));

        const isPartial = allRecs.length > remainingSlots;
        setToastMessage(
          isPartial
            ? t('sources.recommendLimitPartial', { count: String(remainingSlots) })
            : t('sources.recommendSuccess', { count: String(newLinks.length) })
        );
        setShowToast(true);
      } else if (response.ok && data.success && (!data.recommendations || data.recommendations.length === 0)) {
        stopRecommendProgress(false);
        setToastMessage(t('sources.recommendEmpty'));
        setShowToast(true);
      } else {
        stopRecommendProgress(false);
        setToastMessage(t('sources.recommendFailed', { error: data.error || `HTTP ${response.status}` }));
        setShowToast(true);
      }
    } catch (error) {
      stopRecommendProgress(false);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setToastMessage(t('sources.recommendFailed', { error: msg }));
      setShowToast(true);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    gaEvent({ action: 'save_sources', category: 'source' });
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
          setToastMessage(t('toast.error', { error: data.error || `HTTP ${response.status}` }));
          setShowToast(true);
          return;
        }
      } catch (err) {
        console.error('Error saving pending category:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setToastMessage(t('toast.networkError', { error: msg }));
        setShowToast(true);
        return;
      }
      setPendingCategory(null);
      setNewCategory('');
      setIsAddingCategory(false);
    }

    // 카테고리 삭제 일괄 처리
    if (pendingCategoryDeletes.length > 0) {
      await Promise.allSettled(
        pendingCategoryDeletes.map((name) =>
          fetch('/api/categories', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
        )
      );
      setPendingCategoryDeletes([]);
    }

    // 카테고리 이름 변경 일괄 처리 (새 카테고리 생성보다 먼저 실행)
    for (const rename of pendingRenames) {
      try {
        const res = await fetch('/api/categories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName: rename.oldName, newName: rename.newName }),
        });
        if (!res.ok && res.status === 409) {
          setToastMessage(t('sources.categoryExists', { name: rename.newName }));
          setShowToast(true);
          setIsSaving(false);
          return;
        }
      } catch (err) {
        console.error('Error renaming category:', err);
      }
    }
    if (pendingRenames.length > 0) setPendingRenames([]);

    // 로컬에 있는 카테고리 중 DB에 없는 것(새 카테고리) 일괄 생성
    // pendingRenames의 newName은 기존 카테고리 이름 변경이므로 제외
    const renamedNewNames = new Set(pendingRenames.map((r) => r.newName));
    const newCatsToCreate = categories.filter(
      (c) => !initialCategories.some((ic) => ic.name === c.name) && c.name !== pendingCategory && !renamedNewNames.has(c.name)
    );
    if (newCatsToCreate.length > 0) {
      await Promise.allSettled(
        newCatsToCreate.map((c) =>
          fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: c.name }),
          })
        )
      );
    }

    // 카테고리 순서 변경 저장
    if (orderChanged) {
      try {
        await fetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: categories.map((cat) => ({ id: cat.id, name: cat.name })),
          }),
        });
      } catch (err) {
        console.error('Error reordering categories:', err);
      }
      setOrderChanged(false);
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

    if (allSources.length === 0) {
      try {
        const catNames = categories.map(c => c.name);
        const catTranslations = categories.map(c => ({ id: c.id, name: c.name, is_default: c.is_default, translations: c.translations }));
        sessionStorage.setItem('ih:my:categories', JSON.stringify({ data: catNames, translations: catTranslations, timestamp: Date.now() }));
        sessionStorage.removeItem('ih:my:articles');
        sessionStorage.removeItem('ih:home:categories');
        sessionStorage.removeItem('ih:home:articles');
      } catch { /* 무시 */ }
      setIsSaving(false);
      setToastMessage(t('sources.saved'));
      setShowToast(true);
      return;
    }

    // 크롤러 타입이 미지정이거나 AUTO인 소스가 있을 때만 분석 다이얼로그 표시
    const needsAnalysis = Object.values(sourcesByCategory).some((sources) =>
      sources.some((s) => s.url.trim() && (!s.crawlerType || s.crawlerType === 'AUTO'))
    );

    if (needsAnalysis) {
      startAnalysisProgress();
    }
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: allSources,
          categoryNames: categories.map((c) => c.name),
          ...(pendingDeleteIds.length > 0 && { deleteIds: pendingDeleteIds }),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        stopAnalysisProgress(true);

        // 분석 결과를 토스트 메시지에 포함
        let message = t('sources.saved');
        if (data.analysis && data.analysis.length > 0) {
          const ruleCount = data.analysis.filter((a: { method: string }) => a.method === 'rule').length;
          const aiCount = data.analysis.filter((a: { method: string }) => a.method === 'ai').length;
          const parts: string[] = [];
          if (ruleCount > 0) parts.push(`${ruleCount} rule`);
          if (aiCount > 0) parts.push(`${aiCount} AI`);
          if (parts.length > 0) {
            message = t('sources.autoAnalysis', {
              count: String(data.sources?.length || allSources.length),
              methods: parts.join(' / '),
            });
          }
        }
        // 저장 결과로 로컬 상태 업데이트 (DB ID + 크롤러 타입)
        setSourcesByCategory((prev) => {
          const updated = { ...prev };
          for (const [cat, sources] of Object.entries(updated)) {
            updated[cat] = (sources as SourceLink[]).map((s) => {
              // DB 저장 결과에서 매칭 (ID + 크롤러 타입 업데이트)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const saved = data.sources?.find((dbSource: any) => dbSource.base_url === s.url.trim());
              if (saved) {
                return {
                  ...s,
                  id: saved.id.toString(),
                  crawlerType: saved.crawler_type || s.crawlerType,
                  isExisting: true,
                };
              }
              // analysis 결과만 있는 경우 (크롤러 타입만 업데이트)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const analysisMatch = data.analysis?.find((a: any) => a.url === s.url.trim() && a.crawlerType);
              if (analysisMatch) {
                return { ...s, crawlerType: analysisMatch.crawlerType, isExisting: true };
              }
              return s;
            });
          }
          return updated;
        });

        // 봇 차단 소스 → 안내만 표시 (LLM 추출로 크롤링 가능하므로 링크 제거하지 않음)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blockedSources = data.analysis?.filter((a: any) => a.botBlocked) || [];
        if (blockedSources.length > 0) {
          setShowBotBlockedDialog(true);
        }

        setPendingDeleteIds([]);
        try {
          const catNames = categories.map(c => c.name);
          const catTranslations = categories.map(c => ({ id: c.id, name: c.name, is_default: c.is_default, translations: c.translations }));
          sessionStorage.setItem('ih:my:categories', JSON.stringify({ data: catNames, translations: catTranslations, timestamp: Date.now() }));
          sessionStorage.removeItem('ih:my:articles');
          sessionStorage.removeItem('ih:home:categories');
          sessionStorage.removeItem('ih:home:articles');
        } catch { /* 무시 */ }
        setToastMessage(message);
        setShowToast(true);
      } else {
        stopAnalysisProgress(false);
        const detail = data.error || `HTTP ${response.status}`;
        setToastMessage(t('toast.crawlFailed', { error: detail }));
        setShowToast(true);
      }
    } catch (error) {
      stopAnalysisProgress(false);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setToastMessage(t('toast.networkError', { error: msg }));
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


  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => window.history.length > 1 ? router.back() : router.push(`/${language}`)}
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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
              <span>{t('sources.back')}</span>
            </button>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {t('sources.title')}
        </h1>
        <p className="text-sm text-[var(--text-tertiary)] mb-8">
          {t('sources.subtitle')}
        </p>

        {/* Browse Master Categories Button - shown when no categories */}
        {categories.length === 0 && !readOnly && (
          <div
            className="mb-6 flex flex-col items-center justify-center py-10 bg-[var(--bg-secondary)] border border-[var(--border)]"
            style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center mb-4"
              style={{ borderRadius: '16px', backgroundColor: 'var(--accent-light)' }}
            >
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-tertiary)] mb-5">
              {t('sources.subtitle')}
            </p>
            <button
              onClick={handleOpenBrowseMaster}
              className="px-5 py-2.5 text-sm font-medium bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-hover)] active:scale-95 cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              style={{ transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              {t('sources.browseMasterCategories')}
            </button>
          </div>
        )}

        {/* Category Tabs (Chips) with Drag & Drop */}
        <div className="mb-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToParentElement]}
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
                    onDelete={() => {
                      const sources = sourcesByCategory[cat.name] || [];
                      if (sources.some((s) => s.url.trim())) {
                        setDeletingCategory(cat.name);
                      } else {
                        // 하위 링크 없으면 다이얼로그 없이 즉시 삭제
                        const catToDelete = categories.find((c) => c.name === cat.name);
                        const newCategories = categories.filter((c) => c.name !== cat.name);
                        setCategories(newCategories);
                        const newSbc = { ...sourcesByCategory };
                        delete newSbc[cat.name];
                        setSourcesByCategory(newSbc);
                        if (activeCategory === cat.name) setActiveCategory(newCategories[0]?.name || '');
                        if (catToDelete && initialCategories.some((ic) => ic.name === catToDelete.name)) {
                          setPendingCategoryDeletes((prev) => [...prev, cat.name]);
                        }
                      }
                    }}
                    onRename={(newName) => handleRenameCategory(cat.name, newName)}
                    language={language}
                    readOnly={readOnly}
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
                    language === 'vi' ? 'Nhập danh mục...' :
                    language === 'zh' ? '输入类别...' :
                    'カテゴリ名を入力...'
                  }
                  className="px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--accent)] rounded-full focus:outline-none w-32"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-3 py-2 text-xs font-medium bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-hover)]"
                >
                  {language === 'ko' ? '추가' : language === 'en' ? 'Add' : language === 'vi' ? 'Thêm' : language === 'zh' ? '添加' : '追加'}
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
                  {t('sources.cancel')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (readOnly) {
                    setShowLoginDialog(true);
                    return;
                  }
                  if (categories.length >= MAX_CATEGORIES) {
                    setToastMessage(t('sources.maxCategoriesReached', { max: String(MAX_CATEGORIES) }));
                    setShowToast(true);
                    return;
                  }
                  setIsAddingCategory(true);
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-full text-sm text-[var(--accent)] bg-[var(--bg-secondary)] border border-dashed border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors duration-200 cursor-pointer"
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
                {t('sources.linkLabel')}
              </label>
              <button
                onClick={() => setShowScopeDialog(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[var(--accent)] rounded-xl hover:bg-[var(--accent-hover)] active:scale-95 shadow-sm transition-all duration-200 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                {t('sources.recommendLink')}
              </button>
            </div>
            <div className="space-y-3">
              {currentSources.map((source) => (
                <div key={source.id} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-4 transition-all duration-200 hover:shadow-sm">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={source.url}
                      onChange={(e) => handleSourceChange(source.id, 'url', e.target.value)}
                      placeholder={t('sources.urlPlaceholder')}
                      className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all duration-200"
                    />
                    <button
                      onClick={() => handleRemoveLink(source.id)}
                      className="px-3 py-2.5 text-[var(--text-tertiary)] hover:text-red-500 transition-colors cursor-pointer"
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
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={source.name}
                        onChange={(e) => handleSourceChange(source.id, 'name', e.target.value)}
                        placeholder={t('sources.namePlaceholder')}
                        className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all duration-200"
                      />
                      <select
                        value={source.crawlerType}
                        onChange={(e) => handleSourceChange(source.id, 'crawlerType', e.target.value)}
                        className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-all duration-200 cursor-pointer"
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
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-xl text-sm text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-200 cursor-pointer"
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
              <span>{t('sources.addLink')}</span>
            </button>
          </div>
        )}
      </main>

      {/* Bottom Sticky Save Button */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-4 pt-3 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent">
          <button
            onClick={() => {
              if (readOnly) {
                setShowLoginDialog(true);
                return;
              }
              handleSave();
            }}
            disabled={isSaving}
            className="w-full py-4 bg-[var(--accent)] text-white text-base font-semibold rounded-xl hover:bg-[var(--accent-hover)] active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            style={{ boxShadow: 'var(--shadow-md)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
          >
            {isSaving ? t('sources.saving') : t('sources.save')}
          </button>
        </div>
      </div>

      {/* Delete Category Confirmation Dialog */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter" onClick={() => setDeletingCategory(null)} aria-hidden="true" />
          <div
            className="relative w-full max-w-[400px] overflow-hidden dialog-enter"
            style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                {t('sources.deleteCategory')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {t('sources.deleteCategoryConfirm', { name: deletingCategory })}
              </p>
              {(sourcesByCategory[deletingCategory]?.filter((s) => s.isExisting).length || 0) > 0 && (
                <p className="mt-2 text-sm text-red-500">
                  {t('sources.deleteWithLinks', {
                    count: String(sourcesByCategory[deletingCategory].filter((s) => s.isExisting).length),
                  })}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2.5 px-6 py-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <button
                onClick={() => setDeletingCategory(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-medium rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                {t('sources.cancel')}
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-medium text-white rounded-lg active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ backgroundColor: '#DC2626', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#DC2626'; }}
              >
                {isDeleting ? t('sources.deleting') : t('sources.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot Blocked Dialog */}
      {showBotBlockedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter" onClick={() => setShowBotBlockedDialog(false)} aria-hidden="true" />
          <div
            className="relative w-full max-w-[400px] overflow-hidden dialog-enter"
            style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 pt-6 pb-5">
              <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {t('sources.botBlockedDialog')}
              </p>
            </div>
            <div className="px-6 py-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <button
                onClick={() => setShowBotBlockedDialog(false)}
                className="w-full py-2.5 text-sm font-medium text-white rounded-lg active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ backgroundColor: 'var(--accent)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
              >
                {t('dialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Progress Dialog */}
      {showAnalysisDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter" aria-hidden="true" />
          <div
            className="relative w-full max-w-[400px] overflow-hidden dialog-enter"
            style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    크롤링 전략 분석 중
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    AI가 최적의 크롤링 방식을 찾고 있어요
                  </p>
                </div>
              </div>
              <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: 'var(--accent)', width: `${analysisProgress}%`, transition: 'width 300ms cubic-bezier(0.2, 0, 0, 1)' }}
                />
              </div>
              <p className="text-xs mt-2 text-right" style={{ color: 'var(--text-tertiary)' }}>
                {Math.round(analysisProgress)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scope Selection Dialog */}
      {showScopeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter" onClick={() => setShowScopeDialog(false)} aria-hidden="true" />
          <div
            className="relative w-full max-w-[400px] overflow-hidden dialog-enter"
            style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                {t('sources.recommendScope')}
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleRecommendSources('domestic')}
                  className="w-full py-3 px-4 text-sm font-medium rounded-lg active:scale-[0.98] cursor-pointer text-left"
                  style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                  {t('sources.scopeDomestic')}
                </button>
                <button
                  onClick={() => handleRecommendSources('international')}
                  className="w-full py-3 px-4 text-sm font-medium rounded-lg active:scale-[0.98] cursor-pointer text-left"
                  style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                  {t('sources.scopeInternational')}
                </button>
                <button
                  onClick={() => handleRecommendSources('both')}
                  className="w-full py-3 px-4 text-sm font-medium rounded-lg active:scale-[0.98] cursor-pointer text-left"
                  style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                  {t('sources.scopeBoth')}
                </button>
              </div>
            </div>
            <div className="px-6 py-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <button
                onClick={() => setShowScopeDialog(false)}
                className="w-full py-2.5 text-sm font-medium rounded-lg active:scale-95 cursor-pointer"
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
              >
                {t('sources.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommend Loading Dialog */}
      {showRecommendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter" aria-hidden="true" />
          <div
            className="relative w-full max-w-[400px] overflow-hidden dialog-enter"
            style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {t('sources.recommendLoading')}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {t('sources.recommendLoadingDesc')}
                  </p>
                </div>
              </div>
              <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: 'var(--accent)', width: `${recommendProgress}%`, transition: 'width 300ms cubic-bezier(0.2, 0, 0, 1)' }}
                />
              </div>
              <p className="text-xs mt-2 text-right" style={{ color: 'var(--text-tertiary)' }}>
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

      {/* Browse Master Categories Modal */}
      {showBrowseMaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dialog-backdrop-enter" onClick={() => setShowBrowseMaster(false)} aria-hidden="true" />
          <div
            className="relative w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden dialog-enter"
            style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('sources.browseMasterTitle')}</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('sources.browseMasterDesc')}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {masterLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                  <span className="ml-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('sources.browseMasterLoading')}</span>
                </div>
              ) : !masterData || masterData.categories.length === 0 ? (
                <p className="text-center text-sm py-12" style={{ color: 'var(--text-tertiary)' }}>{t('sources.browseMasterEmpty')}</p>
              ) : (
                <div className="space-y-2">
                  {masterData.categories.map((cat) => {
                    const isSelected = selectedMasterCats.has(cat.name);
                    const isExpanded = expandedMasterCats.has(cat.name);
                    const sources = masterData.sourcesByCategory[cat.name] || [];
                    return (
                      <div key={cat.name} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedMasterCats((prev) => {
                                const next = new Set(prev);
                                if (next.has(cat.name)) next.delete(cat.name);
                                else next.add(cat.name);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded accent-[var(--accent)] shrink-0 cursor-pointer"
                          />
                          <button
                            onClick={() => {
                              setExpandedMasterCats((prev) => {
                                const next = new Set(prev);
                                if (next.has(cat.name)) next.delete(cat.name);
                                else next.add(cat.name);
                                return next;
                              });
                            }}
                            className="flex-1 flex items-center justify-between text-left cursor-pointer"
                          >
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {translateCat(cat.name)}
                              <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>({sources.length})</span>
                            </span>
                            <svg
                              className="w-4 h-4"
                              style={{ color: 'var(--text-tertiary)', transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        {isExpanded && sources.length > 0 && (
                          <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
                            <ul className="mt-2 space-y-1.5">
                              {sources.map((s) => (
                                <li key={s.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                                  <span className="truncate">{s.name || s.url}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 px-6 py-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <button
                onClick={() => setShowBrowseMaster(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg active:scale-95 cursor-pointer"
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                {t('sources.cancel')}
              </button>
              <button
                onClick={handleAddMasterCategories}
                disabled={selectedMasterCats.size === 0}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                style={{ backgroundColor: 'var(--accent)', transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
              >
                {t('sources.browseMasterAdd')} {selectedMasterCats.size > 0 && `(${selectedMasterCats.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Prompt */}
      <LoginPromptDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
      />
    </div>
  );
}
