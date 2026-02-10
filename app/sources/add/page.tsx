'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toast } from '@/components';

type SourceLink = {
  id: string;
  url: string;
  name: string;
  isExisting: boolean;
};

export default function AddSourcePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [sourcesByCategory, setSourcesByCategory] = useState<Record<string, SourceLink[]>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('저장되었습니다.');
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Focus category input
  useEffect(() => {
    if (isAddingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  // Fetch existing sources and categories on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [sourcesRes, categoriesRes] = await Promise.all([
          fetch('/api/sources'),
          fetch('/api/categories'),
        ]);

        // Parse categories
        let cats: string[] = ['비즈니스', '소비 트렌드'];
        const dbCatNames = new Set<string>();
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          if (catData.categories && catData.categories.length > 0) {
            cats = catData.categories.map((c: { name: string }) => c.name);
            cats.forEach((c) => dbCatNames.add(c));
          }
        }

        // Parse sources and group by category
        const grouped: Record<string, SourceLink[]> = {};
        for (const cat of cats) {
          grouped[cat] = [];
        }

        if (sourcesRes.ok) {
          const srcData = await sourcesRes.json();
          if (srcData.sources && srcData.sources.length > 0) {
            for (const s of srcData.sources) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const srcCategory = (s.config as any)?.category || cats[0];
              if (!grouped[srcCategory]) {
                grouped[srcCategory] = [];
                if (!cats.includes(srcCategory)) {
                  cats.push(srcCategory);
                }
              }
              grouped[srcCategory].push({
                id: s.id.toString(),
                url: s.base_url,
                name: s.name,
                isExisting: true,
              });
            }
          }
        }

        // crawl_sources에서 발견된 카테고리 중 DB categories 테이블에 없는 것 동기화
        for (const cat of cats) {
          if (!dbCatNames.has(cat)) {
            fetch('/api/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: cat }),
            }).catch((err) => console.error('Error syncing category:', err));
          }
        }

        setCategories(cats);
        setSourcesByCategory(grouped);
        setActiveCategory(cats[0] || '');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    fetchData();
  }, []);

  const currentSources = sourcesByCategory[activeCategory] || [];

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      // DB에 카테고리 저장
      fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      }).catch((err) => console.error('Error saving category:', err));

      setCategories([...categories, trimmed]);
      setSourcesByCategory({ ...sourcesByCategory, [trimmed]: [] });
      setActiveCategory(trimmed);
      setNewCategory('');
      setIsAddingCategory(false);
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
        const newCategories = categories.filter((c) => c !== deletingCategory);
        const newSourcesByCategory = { ...sourcesByCategory };
        delete newSourcesByCategory[deletingCategory];

        setCategories(newCategories);
        setSourcesByCategory(newSourcesByCategory);

        if (activeCategory === deletingCategory) {
          setActiveCategory(newCategories[0] || '');
        }

        setToastMessage(`'${deletingCategory}' 카테고리가 삭제되었습니다.`);
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    } finally {
      setIsDeleting(false);
      setDeletingCategory(null);
    }
  };

  const handleSourceChange = (id: string, field: 'url' | 'name', value: string) => {
    setSourcesByCategory({
      ...sourcesByCategory,
      [activeCategory]: currentSources.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    });
  };

  const handleAddLink = () => {
    setSourcesByCategory({
      ...sourcesByCategory,
      [activeCategory]: [
        ...currentSources,
        { id: `new-${Date.now()}`, url: '', name: '', isExisting: false },
      ],
    });
  };

  const handleRemoveLink = (id: string) => {
    setSourcesByCategory({
      ...sourcesByCategory,
      [activeCategory]: currentSources.filter((s) => s.id !== id),
    });
  };

  const handleSave = async () => {
    // Collect all valid sources from all categories
    const allSources: { url: string; name: string; category: string }[] = [];
    for (const [cat, sources] of Object.entries(sourcesByCategory)) {
      for (const s of sources) {
        if (s.url.trim()) {
          allSources.push({
            url: s.url.trim(),
            name: s.name.trim() || extractDomainName(s.url),
            category: cat,
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
        body: JSON.stringify({ sources: allSources }),
      });

      const data = await response.json();

      if (response.ok) {
        setToastMessage('저장되었습니다.');
        setShowToast(true);
        setTimeout(() => {
          router.push('/');
        }, 2200);
      } else {
        const detail = data.error || `HTTP ${response.status}`;
        setToastMessage(`저장 실패: ${detail}`);
        setShowToast(true);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '알 수 없는 오류';
      setToastMessage(`네트워크 오류: ${msg}`);
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
          <div className="flex items-center h-16">
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
              <span>돌아가기</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          소스 관리
        </h1>
        <p className="text-sm text-[var(--text-tertiary)] mb-8">
          카테고리별로 크롤링할 웹사이트를 관리하세요.
        </p>

        {/* Category Tabs (Chips) */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <div key={cat} className="relative group flex items-center">
                <button
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                >
                  {cat}
                  {(sourcesByCategory[cat]?.length || 0) > 0 && (
                    <span className={`ml-1.5 text-xs ${
                      activeCategory === cat ? 'text-white/70' : 'text-[var(--text-tertiary)]'
                    }`}>
                      {sourcesByCategory[cat].length}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingCategory(cat);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-tertiary)] hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
                  placeholder="분류명 입력..."
                  className="px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--accent)] rounded-full focus:outline-none w-32"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-3 py-2 text-xs font-medium bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-hover)]"
                >
                  추가
                </button>
                <button
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategory('');
                  }}
                  className="px-3 py-2 text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-full border border-[var(--border)]"
                >
                  취소
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
        </div>

        {/* Source Links for Active Category */}
        {activeCategory && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              출처 링크
            </label>
            <div className="space-y-3">
              {currentSources.map((source) => (
                <div key={source.id} className="relative">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={source.url}
                      onChange={(e) => handleSourceChange(source.id, 'url', e.target.value)}
                      placeholder="https://example.com/blog"
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
                    <input
                      type="text"
                      value={source.name}
                      onChange={(e) => handleSourceChange(source.id, 'name', e.target.value)}
                      placeholder="소스 이름 (선택)"
                      className="mt-2 w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
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
              <span>링크 추가하기</span>
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
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>

      {/* Delete Category Confirmation Dialog */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-primary)] rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                카테고리 삭제
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                <span className="font-medium text-[var(--text-primary)]">&apos;{deletingCategory}&apos;</span> 카테고리를 삭제하시겠습니까?
              </p>
              {(sourcesByCategory[deletingCategory]?.filter((s) => s.isExisting).length || 0) > 0 && (
                <p className="mt-2 text-sm text-red-500">
                  저장한 링크 {sourcesByCategory[deletingCategory].filter((s) => s.isExisting).length}개가 함께 삭제됩니다.
                </p>
              )}
            </div>
            <div className="flex border-t border-[var(--border)]">
              <button
                onClick={() => setDeletingCategory(null)}
                disabled={isDeleting}
                className="flex-1 py-3.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                취소
              </button>
              <div className="w-px bg-[var(--border)]" />
              <button
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                className="flex-1 py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
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
