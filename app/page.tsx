'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Header, FilterBar, ArticleGrid, Toast } from '@/components';
import type { Article, ArticleListResponse, CrawlStatus, Language } from '@/types';
import { DEFAULT_CATEGORIES } from '@/types';
import { t } from '@/lib/i18n';

const STORAGE_KEY = {
  HOME_ARTICLES: 'ih:home:articles',
  HOME_CATEGORIES: 'ih:home:categories',
  LANGUAGE: 'ih:language',
} as const;

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState('');
  const [language, setLanguage] = useState<Language>('ko');
  const initialLoadDone = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef(search);
  const categoryRef = useRef(category);

  // 언어 설정 초기화 (URL 파라미터 우선, localStorage 차선)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang && ['ko', 'en', 'ja', 'zh'].includes(urlLang)) {
        setLanguage(urlLang as Language);
        localStorage.setItem(STORAGE_KEY.LANGUAGE, urlLang);
        return;
      }
      const saved = localStorage.getItem(STORAGE_KEY.LANGUAGE);
      if (saved && ['ko', 'en', 'ja', 'zh'].includes(saved)) {
        setLanguage(saved as Language);
      }
    } catch { /* 무시 */ }
  }, []);

  // 언어 변경 핸들러 (localStorage + URL 파라미터 동시 업데이트)
  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY.LANGUAGE, lang);
      // URL 파라미터 업데이트 (영어권 공유 링크 등에 활용)
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url.toString());
    } catch { /* 무시 */ }
  }, []);

  const fetchArticles = useCallback(
    async (pageNum: number, append: boolean = false) => {
      // 초기 로드 시 sessionStorage stale 데이터가 이미 렌더됐으면 로딩 스피너 억제
      const showLoader = !(pageNum === 1 && !append && articles.length > 0 && !initialLoadDone.current);
      if (showLoader) setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', '12');

        if (search) params.set('search', search);
        if (category) params.set('category', category);

        const response = await fetch(`/api/articles?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch articles');
        }

        const data: ArticleListResponse = await response.json();

        if (append) {
          setArticles((prev) => [...prev, ...data.articles]);
        } else {
          setArticles(data.articles);
          // 초기 로드 (page 1, 필터 없음) 시 sessionStorage에 캐시
          if (pageNum === 1 && !search && category === categories[0]) {
            try {
              sessionStorage.setItem(STORAGE_KEY.HOME_ARTICLES, JSON.stringify(data));
            } catch { /* quota 초과 시 무시 */ }
          }
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
        initialLoadDone.current = true;
      }
    },
    [search, category, lastUpdated, articles.length]
  );

  // sessionStorage에서 초기 데이터 즉시 로드 + categories 로드
  useEffect(() => {
    // 1. articles stale 데이터 즉시 렌더
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY.HOME_ARTICLES);
      if (cached) {
        const data: ArticleListResponse = JSON.parse(cached);
        setArticles(data.articles);
        setHasMore(data.hasMore);
        setTotalCount(data.total);
        if (data.articles.length > 0) {
          setLastUpdated(data.articles[0].crawled_at);
        }
        setIsLoading(false); // 스켈레톤 대신 캐시 데이터 즉시 표시
      }
    } catch { /* 무시 */ }

    // 2. categories stale 데이터 즉시 렌더
    try {
      const cachedCats = sessionStorage.getItem(STORAGE_KEY.HOME_CATEGORIES);
      if (cachedCats) {
        const names: string[] = JSON.parse(cachedCats);
        if (names.length > 0) setCategories(names);
      }
    } catch { /* 무시 */ }

    // 3. categories API 리밸리데이트
    async function revalidateCategories() {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          if (data.categories && data.categories.length > 0) {
            const categoryNames = data.categories.map(
              (c: { name: string }) => c.name
            );
            setCategories(categoryNames);
            // 항상 첫 번째 카테고리를 기본값으로 설정
            setCategory(categoryNames[0] || '');
            try {
              sessionStorage.setItem(STORAGE_KEY.HOME_CATEGORIES, JSON.stringify(categoryNames));
            } catch { /* 무시 */ }
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }

    revalidateCategories();
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

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Keep refs in sync for polling closure
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { categoryRef.current = category; }, [category]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Handle refresh - 자료 불러오기 (폴링 기반 실시간 갱신)
  const handleRefresh = () => {
    if (isCrawling) return;

    setIsCrawling(true);
    setCrawlProgress('크롤링 시작...');

    // 캐시 무효화
    try {
      sessionStorage.removeItem(STORAGE_KEY.HOME_ARTICLES);
    } catch { /* 무시 */ }

    // 4초 간격으로 크롤링 상태 + 아티클 폴링
    pollingRef.current = setInterval(async () => {
      // 1. 크롤링 상태 확인 (진행률 표시)
      try {
        const statusRes = await fetch('/api/crawl/status');
        if (statusRes.ok) {
          const status: CrawlStatus = await statusRes.json();

          if (status.totalSources > 0) {
            const progress = status.newArticles > 0
              ? `${status.completedSources}/${status.totalSources} 소스 완료 · ${status.newArticles}개 새 아티클`
              : `${status.completedSources}/${status.totalSources} 소스 완료`;
            setCrawlProgress(progress);
          }
        }
      } catch { /* 무시 */ }

      // 2. 아티클 목록 조용히 갱신 (로딩 스피너 없이)
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '12');
        if (searchRef.current) params.set('search', searchRef.current);
        if (categoryRef.current) params.set('category', categoryRef.current);

        const res = await fetch(`/api/articles?${params.toString()}`);
        if (res.ok) {
          const data: ArticleListResponse = await res.json();
          setArticles(data.articles);
          setHasMore(data.hasMore);
          setTotalCount(data.total);
        }
      } catch { /* 무시 */ }
    }, 4000);

    // 트리거 호출 - 선택된 카테고리 전달
    const requestCategory = category || undefined;

    fetch('/api/crawl/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: requestCategory }),
    })
      .then((res) => res.json())
      .then((data) => {
        stopPolling();
        setIsCrawling(false);
        setCrawlProgress('');

        if (data.error) {
          setToastMessage(t(language, 'toast.crawlFailed', { error: data.error }));
          setShowToast(true);
          return;
        }

        const totalNew = data.results?.reduce(
          (sum: number, r: { new?: number }) => sum + (r.new || 0),
          0
        );

        setToastMessage(
          totalNew > 0
            ? t(language, 'toast.crawlSuccess', { count: String(totalNew) })
            : t(language, 'toast.noNewInsights')
        );
        setShowToast(true);

        // 최종 갱신
        setPage(1);
        fetchArticles(1, false);
        setLastUpdated(new Date().toISOString());
      })
      .catch((error) => {
        stopPolling();
        setIsCrawling(false);
        setCrawlProgress('');
        setToastMessage(t(language, 'toast.networkError', {
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
        setShowToast(true);
      });
  };

  // Handle article deletion
  const handleArticleDelete = useCallback((articleId: string) => {
    // 삭제된 아티클을 목록에서 제거
    setArticles((prev) => prev.filter((article) => article.id !== articleId));
    setTotalCount((prev) => Math.max(0, prev - 1));

    // 성공 토스트 표시
    setToastMessage(t(language, 'toast.articleDeleted'));
    setShowToast(true);

    // sessionStorage 캐시 무효화
    try {
      sessionStorage.removeItem(STORAGE_KEY.HOME_ARTICLES);
    } catch { /* 무시 */ }
  }, [language]);

  // Handle add category
  return (
    <div className="min-h-screen">
      <Header
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        isCrawling={isCrawling}
        crawlProgress={crawlProgress}
        language={language}
        onLanguageChange={handleLanguageChange}
        selectedCategory={category}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Filter Bar */}
        <div className="mb-6 sm:mb-8">
          <FilterBar
            search={search}
            onSearchChange={handleSearchChange}
            category={category}
            onCategoryChange={handleCategoryChange}
            categories={categories}
            totalCount={totalCount}
            language={language}
          />
        </div>

        {/* Article Grid */}
        <ArticleGrid
          articles={articles}
          language={language}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onDelete={handleArticleDelete}
        />
      </main>

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
