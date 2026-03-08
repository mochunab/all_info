'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Header, FilterBar, ArticleGrid, Toast, Footer } from '@/components';
import type { Article, ArticleListResponse, CrawlStatus } from '@/types';
import { event as gaEvent } from '@/lib/gtag';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/language-context';

const InsightChat = dynamic(() => import('@/components/InsightChat'), { ssr: false });

const STORAGE_KEY = {
  HOME_ARTICLES: 'ih:home:articles',
  HOME_CATEGORIES: 'ih:home:categories',
  CATEGORY: 'ih:category',
} as const;

const CLIENT_CACHE_TTL = 5 * 60 * 1000;

type HomeFeedProps = {
  initialArticles: Article[];
  initialCategories: string[];
  initialTotal: number;
  initialHasMore: boolean;
};

export default function HomeFeed({
  initialArticles,
  initialCategories,
  initialTotal,
  initialHasMore,
}: HomeFeedProps) {
  const defaultCategory = initialCategories[0] || '';
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(defaultCategory);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY.CATEGORY);
      if (saved && initialCategories.includes(saved) && saved !== defaultCategory) {
        setCategory(saved);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>(
    initialArticles[0]?.crawled_at
  );
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pinnedArticle, setPinnedArticle] = useState<Article | null>(null);
  const { language, setLanguage, t, setCategoryTranslations } = useLanguage();
  const { user: authUser } = useAuth();
  const isLoggedIn = !!authUser;
  const [isNonMasterUser, setIsNonMasterUser] = useState(false);
  useEffect(() => {
    if (!authUser) { setIsNonMasterUser(false); return; }
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('users').select('role').eq('id', authUser.id).single()
      .then(({ data }: { data: { role: string } | null }) => {
        if (data && data.role !== 'master') setIsNonMasterUser(true);
      });
  }, [authUser]);

  const initialLoadDone = useRef(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef(search);
  const categoryRef = useRef(category);
  const crawlSeenRunning = useRef(false);
  const crawlAbortRef = useRef<AbortController | null>(null);
  const articlesCacheRef = useRef<Map<string, { articles: Article[]; totalCount: number; hasMore: boolean; timestamp: number }>>(new Map());
  const fetchAbortRef = useRef<AbortController | null>(null);
  const isInitialRender = useRef(true);

  const fetchArticles = useCallback(
    async (pageNum: number, append: boolean = false, options?: { signal?: AbortSignal; silent?: boolean }) => {
      const showLoader = !(pageNum === 1 && !append && articles.length > 0 && !initialLoadDone.current);
      if (!options?.silent && showLoader) setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', '12');

        if (search) params.set('search', search);
        if (category) params.set('category', category);

        const response = await fetch(`/api/articles?${params.toString()}`, {
          signal: options?.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch articles');
        }

        const data: ArticleListResponse = await response.json();

        if (append) {
          setArticles((prev) => [...prev, ...data.articles]);
        } else {
          setArticles(data.articles);
          if (pageNum === 1 && !search && category === categories[0]) {
            try {
              sessionStorage.setItem(STORAGE_KEY.HOME_ARTICLES, JSON.stringify({ data, timestamp: Date.now() }));
            } catch { /* quota exceeded */ }
          }
        }

        setHasMore(data.hasMore);
        setTotalCount(data.total);

        if (pageNum === 1 && !append && !search && category) {
          articlesCacheRef.current.set(category, {
            articles: data.articles,
            totalCount: data.total,
            hasMore: data.hasMore,
            timestamp: Date.now(),
          });
        }

        if (data.articles.length > 0 && !lastUpdated) {
          setLastUpdated(data.articles[0].crawled_at);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Error fetching articles:', error);
      } finally {
        if (!options?.silent) setIsLoading(false);
        initialLoadDone.current = true;
      }
    },
    [search, category, lastUpdated, articles.length]
  );

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY.HOME_CATEGORIES);
      if (cached) {
        const raw = JSON.parse(cached);
        if (raw.timestamp && Date.now() - raw.timestamp < CLIENT_CACHE_TTL) {
          if (raw.translations) setCategoryTranslations(raw.translations);
          return;
        }
      }
    } catch { /* ignore */ }

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
            setCategoryTranslations(data.categories);
            try {
              sessionStorage.setItem(STORAGE_KEY.HOME_CATEGORIES, JSON.stringify({ data: categoryNames, translations: data.categories, timestamp: Date.now() }));
            } catch { /* ignore */ }
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }
    revalidateCategories();
  }, []);

  useEffect(() => {
    if (!category) return;

    // Skip fetch on initial render if showing default category with server data
    if (isInitialRender.current && category === defaultCategory && !search) {
      isInitialRender.current = false;
      return;
    }
    isInitialRender.current = false;

    setPage(1);
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const cached = !search ? articlesCacheRef.current.get(category) : null;

    if (cached) {
      setArticles(cached.articles);
      setTotalCount(cached.totalCount);
      setHasMore(cached.hasMore);
      setIsLoading(false);

      if (Date.now() - cached.timestamp < CLIENT_CACHE_TTL) return;
      fetchArticles(1, false, { signal: controller.signal, silent: true });
    } else {
      fetchArticles(1, false, { signal: controller.signal });
    }

    return () => controller.abort();
  }, [search, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    gaEvent({ action: 'load_more', category: 'navigation', label: `page_${page + 1}` });
    const nextPage = page + 1;
    setPage(nextPage);
    fetchArticles(nextPage, true);
  };

  const handleSearchChange = useCallback((value: string) => {
    if (value) gaEvent({ action: 'search', category: 'filter', label: value });
    setSearch(value);
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    gaEvent({ action: 'filter_category', category: 'filter', label: value || 'all' });
    setCategory(value);
    try { localStorage.setItem(STORAGE_KEY.CATEGORY, value); } catch { /* ignore */ }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    crawlSeenRunning.current = false;
    if (crawlAbortRef.current) {
      crawlAbortRef.current.abort();
      crawlAbortRef.current = null;
    }
  }, []);

  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleRefresh = () => {
    if (isCrawling) return;
    gaEvent({ action: 'crawl_trigger', category: 'crawling', label: 'home' });
    setIsCrawling(true);
    setCrawlProgress('\uD06C\uB864\uB9C1 \uC2DC\uC791...');

    articlesCacheRef.current.clear();
    try { sessionStorage.removeItem(STORAGE_KEY.HOME_ARTICLES); } catch { /* ignore */ }
    try { sessionStorage.removeItem(STORAGE_KEY.HOME_CATEGORIES); } catch { /* ignore */ }

    pollingRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch('/api/crawl/status');
        if (statusRes.ok) {
          const status: CrawlStatus = await statusRes.json();
          if (status.isRunning) {
            crawlSeenRunning.current = true;
            const progress = status.newArticles > 0
              ? `${status.newArticles}개 콘텐츠 가져오는 중...`
              : '콘텐츠 검색 중...';
            setCrawlProgress(progress);
          } else if (crawlSeenRunning.current) {
            setCrawlProgress('AI 요약 생성 중...');
          }
        }
      } catch { /* ignore */ }

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
      } catch { /* ignore */ }
    }, 4000);

    const requestCategory = category || undefined;
    const controller = new AbortController();
    crawlAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

    fetch('/api/crawl/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: requestCategory }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        clearTimeout(timeoutId);
        stopPolling();
        setIsCrawling(false);
        setCrawlProgress('');

        if (data.error) {
          setToastMessage(t('toast.crawlFailed', { error: data.error }));
          setShowToast(true);
          return;
        }

        const totalNew = data.results?.reduce(
          (sum: number, r: { new?: number }) => sum + (r.new || 0),
          0
        );

        setToastMessage(
          totalNew > 0
            ? t('toast.crawlSuccess', { count: String(totalNew) })
            : t('toast.noNewInsights')
        );
        setShowToast(true);

        setPage(1);
        setLastUpdated(new Date().toISOString());
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '12');
        if (searchRef.current) params.set('search', searchRef.current);
        if (categoryRef.current) params.set('category', categoryRef.current);
        params.set('nocache', '1');

        fetch(`/api/articles?${params.toString()}`, { cache: 'no-store' })
          .then(res => res.ok ? res.json() : null)
          .then((freshData: ArticleListResponse | null) => {
            if (freshData) {
              setArticles(freshData.articles);
              setHasMore(freshData.hasMore);
              setTotalCount(freshData.total);
            }
          })
          .catch(() => {});
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if ((error as Error).name === 'AbortError') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          crawlSeenRunning.current = false;
          setIsCrawling(false);
          setCrawlProgress('');
          setPage(1);
          const abortParams = new URLSearchParams();
          abortParams.set('page', '1');
          abortParams.set('limit', '12');
          if (searchRef.current) abortParams.set('search', searchRef.current);
          if (categoryRef.current) abortParams.set('category', categoryRef.current);
          abortParams.set('nocache', '1');
          fetch(`/api/articles?${abortParams.toString()}`, { cache: 'no-store' })
            .then(res => res.ok ? res.json() : null)
            .then((d: ArticleListResponse | null) => {
              if (d) { setArticles(d.articles); setHasMore(d.hasMore); setTotalCount(d.total); }
            })
            .catch(() => {});
          setLastUpdated(new Date().toISOString());
          return;
        }
        stopPolling();
        setIsCrawling(false);
        setCrawlProgress('');
        setToastMessage(t('toast.networkError', {
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
        setShowToast(true);
      });
  };

  const handleChatReference = useCallback((article: Article) => {
    setPinnedArticle(article);
  }, []);

  const handleArticleDelete = useCallback((articleId: string) => {
    setArticles((prev) => prev.filter((article) => article.id !== articleId));
    setTotalCount((prev) => Math.max(0, prev - 1));

    setToastMessage(t('toast.articleDeleted'));
    setShowToast(true);

    if (category) articlesCacheRef.current.delete(category);
    try {
      sessionStorage.removeItem(STORAGE_KEY.HOME_ARTICLES);
    } catch { /* ignore */ }
  }, [language, category]);

  return (
    <div className="min-h-screen">
      <Header
        language={language}
        onLanguageChange={setLanguage}
      />

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-all duration-300 ${isChatOpen ? 'lg:pr-[460px]' : ''}`}>
        <div className="mb-6 sm:mb-8">
          <FilterBar
            search={search}
            onSearchChange={handleSearchChange}
            category={category}
            onCategoryChange={handleCategoryChange}
            categories={categories}
            totalCount={totalCount}
            language={language}
            onRefresh={handleRefresh}
            isCrawling={isCrawling}
            crawlProgress={crawlProgress}
            hideAddSource={isNonMasterUser}
          />
        </div>

        <ArticleGrid
          articles={articles}
          language={language}
          isLoading={isLoading}
          hasMore={hasMore}
          search={search}
          isChatOpen={isChatOpen}
          onLoadMore={handleLoadMore}
          onDelete={isLoggedIn && !isNonMasterUser ? handleArticleDelete : undefined}
          onChatReference={isChatOpen ? handleChatReference : undefined}
          onCloseChat={isChatOpen ? () => setIsChatOpen(false) : undefined}
        />
      </main>

      <Footer language={language} />

      {!isChatOpen && (
        <div className="fixed bottom-6 left-0 right-0 z-50 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none">
          <button
            className="ml-auto flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 pointer-events-auto cursor-pointer"
            onClick={() => setIsChatOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm font-medium">{t('chat.buttonLabel')}</span>
          </button>
        </div>
      )}

      <InsightChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        articles={articles}
        category={category}
        language={language}
        pinnedArticle={pinnedArticle}
        onClearPinned={() => setPinnedArticle(null)}
        isLoggedIn={isLoggedIn}
      />

      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2200}
      />
    </div>
  );
}
