'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toast } from '@/components';

interface SourceLink {
  id: string;
  url: string;
  name: string;
}

export default function AddSourcePage() {
  const router = useRouter();
  const [category, setCategory] = useState('비즈니스');
  const [categories, setCategories] = useState(['비즈니스', '소비 트렌드']);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [sources, setSources] = useState<SourceLink[]>([
    { id: '1', url: '', name: '' },
    { id: '2', url: '', name: '' },
    { id: '3', url: '', name: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
        setIsAddingCategory(false);
        setNewCategory('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus category input
  useEffect(() => {
    if (isAddingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  // Fetch existing sources on mount
  useEffect(() => {
    async function fetchExistingSources() {
      try {
        const response = await fetch('/api/sources');
        if (response.ok) {
          const data = await response.json();
          if (data.sources && data.sources.length > 0) {
            const existingSources = data.sources.map((s: { id: number; base_url: string; name: string }) => ({
              id: s.id.toString(),
              url: s.base_url,
              name: s.name,
            }));
            // Fill up to 3 minimum
            while (existingSources.length < 3) {
              existingSources.push({
                id: `new-${Date.now()}-${existingSources.length}`,
                url: '',
                name: '',
              });
            }
            setSources(existingSources);
          }
        }
      } catch (error) {
        console.error('Error fetching sources:', error);
      }
    }

    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          if (data.categories && data.categories.length > 0) {
            setCategories(data.categories.map((c: { name: string }) => c.name));
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }

    fetchExistingSources();
    fetchCategories();
  }, []);

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setCategory(newCategory.trim());
      setNewCategory('');
      setIsAddingCategory(false);
      setIsCategoryDropdownOpen(false);
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

  const handleSourceChange = (id: string, field: 'url' | 'name', value: string) => {
    setSources(sources.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleAddLink = () => {
    setSources([...sources, { id: `new-${Date.now()}`, url: '', name: '' }]);
  };

  const handleRemoveLink = (id: string) => {
    if (sources.length > 3) {
      setSources(sources.filter((s) => s.id !== id));
    }
  };

  const handleSave = async () => {
    const validSources = sources.filter((s) => s.url.trim());
    if (validSources.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: validSources.map((s) => ({
            url: s.url.trim(),
            name: s.name.trim() || extractDomainName(s.url),
            category,
          })),
        }),
      });

      if (response.ok) {
        setShowToast(true);
        setTimeout(() => {
          router.push('/');
        }, 2200);
      }
    } catch (error) {
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

  const hasValidSources = sources.some((s) => s.url.trim());

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
          소스 추가하기
        </h1>
        <p className="text-sm text-[var(--text-tertiary)] mb-8">
          비즈니스 인사이트를 크롤링할 웹사이트를 추가하세요.
        </p>

        {/* Category Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            분류
          </label>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
            >
              <span>{category}</span>
              <svg
                className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform ${
                  isCategoryDropdownOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isCategoryDropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="py-1 max-h-64 overflow-y-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategory(cat);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between ${
                        category === cat
                          ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      <span>{cat}</span>
                      {category === cat && (
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  ))}

                  <div className="border-t border-[var(--border)] my-1" />

                  {isAddingCategory ? (
                    <div className="px-3 py-2">
                      <input
                        ref={categoryInputRef}
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={handleCategoryKeyDown}
                        placeholder="분류명 입력..."
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--accent)]"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleAddCategory}
                          className="flex-1 px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)]"
                        >
                          추가
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingCategory(false);
                            setNewCategory('');
                          }}
                          className="flex-1 px-3 py-1.5 text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-md"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingCategory(true)}
                      className="w-full px-4 py-3 text-left text-sm text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
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
                      <span>분류 추가</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Source Links */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            출처 링크
          </label>
          <div className="space-y-3">
            {sources.map((source) => (
              <div key={source.id} className="relative">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={source.url}
                    onChange={(e) => handleSourceChange(source.id, 'url', e.target.value)}
                    placeholder={`https://example.com/blog`}
                    className="flex-1 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  {sources.length > 3 && (
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
                  )}
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

      {/* Toast */}
      <Toast
        message="저장되었습니다."
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2200}
      />
    </div>
  );
}
