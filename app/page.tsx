'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header, FilterBar, ArticleGrid, Toast } from '@/components';
import { Article, ArticleListResponse, DEFAULT_CATEGORIES } from '@/types';

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchArticles = useCallback(
    async (pageNum: number, append: boolean = false) => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', '12');

        if (search) params.set('search', search);
        if (category !== '전체') params.set('category', category);

        const response = await fetch(`/api/articles?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch articles');
        }

        const data: ArticleListResponse = await response.json();

        if (append) {
          setArticles((prev) => [...prev, ...data.articles]);
        } else {
          setArticles(data.articles);
        }

        setHasMore(data.hasMore);
        setTotalCount(data.total);

        // Get last updated time from the most recent article
        if (data.articles.length > 0 && !lastUpdated) {
          setLastUpdated(data.articles[0].crawled_at);
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [search, category, lastUpdated]
  );

  // Fetch categories on mount
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          if (data.categories && data.categories.length > 0) {
            const categoryNames = data.categories.map(
              (c: { name: string }) => c.name
            );
            setCategories(categoryNames);
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }

    fetchCategories();
  }, []);

  // Fetch articles when filters change
  useEffect(() => {
    setPage(1);
    fetchArticles(1, false);
  }, [search, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more handler
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchArticles(nextPage, true);
  };

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  // Handle refresh - 자료 불러오기
  const handleRefresh = async () => {
    try {
      const response = await fetch('/api/crawl/trigger', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        const totalNew = data.results?.reduce(
          (sum: number, r: { new?: number }) => sum + (r.new || 0),
          0
        );

        setToastMessage(
          totalNew > 0
            ? `${totalNew}개의 새 인사이트를 불러왔습니다.`
            : '새로운 인사이트가 없습니다.'
        );
        setShowToast(true);

        // Refresh articles list
        setPage(1);
        fetchArticles(1, false);
        setLastUpdated(new Date().toISOString());
      }
    } catch (error) {
      console.error('Error refreshing:', error);
      setToastMessage('인사이트 불러오기에 실패했습니다.');
      setShowToast(true);
    }
  };

  // Handle add category
  return (
    <div className="min-h-screen">
      <Header lastUpdated={lastUpdated} onRefresh={handleRefresh} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Filter Bar */}
        <div className="mb-6 sm:mb-8">
          <FilterBar
            search={search}
            onSearchChange={handleSearchChange}
            category={category}
            onCategoryChange={setCategory}
            categories={categories}
            totalCount={totalCount}
          />
        </div>

        {/* Article Grid */}
        <ArticleGrid
          articles={articles}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <span
                className="text-lg font-bold text-[var(--text-primary)]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Insight Hub
              </span>
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">
              매일 아침 9시, 비즈니스 인사이트가 업데이트됩니다.
            </p>
          </div>
        </div>
      </footer>

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
