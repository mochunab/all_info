'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Header, FilterBar, ArticleGrid, Toast, Footer, LoginPromptDialog } from '@/components';
import type { Article, ArticleListResponse, CrawlStatus } from '@/types';
import { event as gaEvent } from '@/lib/gtag';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';

const InsightChat = dynamic(() => import('@/components/InsightChat'), { ssr: false });

const STORAGE_KEY = {
  MY_ARTICLES: 'ih:my:articles',
  MY_CATEGORIES: 'ih:my:categories',
  MY_CATEGORY: 'ih:my:category',
} as const;

const CLIENT_CACHE_TTL = 5 * 60 * 1000;

export default function MyFeed() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const authChecked = !authLoading;
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pinnedArticle, setPinnedArticle] = useState<Article | null>(null);
  const { language, setLanguage, t, setCategoryTranslations } = useLanguage();
  const initialLoadDone = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef(search);
  const categoryRef = useRef(category);
  const crawlSeenRunning = useRef(false);
  const crawlAbortRef = useRef<AbortController | null>(null);
  const articlesCacheRef = useRef<Map<string, { articles: Article[]; totalCount: number; hasMore: boolean; timestamp: number }>>(new Map());
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (authChecked && !user) setShowLoginDialog(true);
  }, [authChecked, user]);

  const fetchArticles = useCallback(
    async (pageNum: number, append: boolean = false, options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!user) return;

      const showLoader = !(pageNum === 1 && !append && articles.length > 0 && !initialLoadDone.current);
      if (!options?.silent && showLoader) setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', '12');
        params.set('user_id', user.id);

        if (search) params.set('search', search);
        if (category) params.set('category', category);

        const response = await fetch(`/api/articles?${params.toString()}`, {
          signal: options?.signal,
        });

        if (!response.ok) throw new Error('Failed to fetch articles');

        const data: ArticleListResponse = await response.json();

        if (append) {
          setArticles((prev) => [...prev, ...data.articles]);
        } else {
          setArticles(data.articles);
          if (pageNum === 1 && !search && category === categories[0]) {
            try {
              sessionStorage.setItem(STORAGE_KEY.MY_ARTICLES, JSON.stringify(data));
            } catch { /* quota */ }
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
    [user, search, category, lastUpdated, articles.length, categories]
  );

  // Load initial data after auth
  useEffect(() => {
    if (!user) return;

    // 1. articles stale data
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY.MY_ARTICLES);
      if (cached) {
        const data: ArticleListResponse = JSON.parse(cached);
        setArticles(data.articles);
        setHasMore(data.hasMore);
        setTotalCount(data.total);
        if (data.articles.length > 0) setLastUpdated(data.articles[0].crawled_at);
        setIsLoading(false);
      }
    } catch { /* ignore */ }

    // 2. categories stale data
    try {
      const cachedCats = sessionStorage.getItem(STORAGE_KEY.MY_CATEGORIES);
      if (cachedCats) {
        const names: string[] = JSON.parse(cachedCats);
        if (names.length > 0) {
          setCategories(names);
          const saved = localStorage.getItem(STORAGE_KEY.MY_CATEGORY);
          setCategory(saved && names.includes(saved) ? saved : names[0]);
        }
      }
    } catch { /* ignore */ }

    // 3. categories API revalidate
    async function revalidateCategories() {
      try {
        const response = await fetch(`/api/categories?user_id=${user!.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.categories && data.categories.length > 0) {
            const categoryNames = data.categories.map((c: { name: string }) => c.name);
            setCategories(categoryNames);
            setCategoryTranslations(data.categories);
            const saved = localStorage.getItem(STORAGE_KEY.MY_CATEGORY);
            setCategory(saved && categoryNames.includes(saved) ? saved : categoryNames[0] || '');
            try {
              sessionStorage.setItem(STORAGE_KEY.MY_CATEGORIES, JSON.stringify(categoryNames));
            } catch { /* ignore */ }
          } else {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        setIsLoading(false);
      }
    }

    revalidateCategories();
  }, [user]);

  useEffect(() => {
    if (!category || !user) return;
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
  }, [search, category, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    gaEvent({ action: 'load_more', category: 'navigation', label: `my_feed_page_${page + 1}` });
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
    try { localStorage.setItem(STORAGE_KEY.MY_CATEGORY, value); } catch { /* ignore */ }
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
    if (isCrawling || !user) return;
    gaEvent({ action: 'crawl_trigger', category: 'crawling', label: 'my_feed' });

    setIsCrawling(true);
    setCrawlProgress('크롤링 시작...');

    articlesCacheRef.current.clear();
    try { sessionStorage.removeItem(STORAGE_KEY.MY_ARTICLES); } catch { /* ignore */ }

    pollingRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch('/api/crawl/status');
        if (statusRes.ok) {
          const status: CrawlStatus = await statusRes.json();
          if (status.isRunning) {
            crawlSeenRunning.current = true;
            setCrawlProgress(
              status.newArticles > 0
                ? `${status.newArticles}개 콘텐츠 가져오는 중...`
                : '콘텐츠 검색 중...'
            );
          } else if (crawlSeenRunning.current) {
            setCrawlProgress('AI 요약 생성 중...');
          }
        }
      } catch { /* ignore */ }

      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '12');
        params.set('user_id', user.id);
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
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '12');
        params.set('user_id', user.id);
        if (searchRef.current) params.set('search', searchRef.current);
        if (categoryRef.current) params.set('category', categoryRef.current);
        params.set('_t', Date.now().toString());

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
        setLastUpdated(new Date().toISOString());
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if ((error as Error).name === 'AbortError') {
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          crawlSeenRunning.current = false;
          setIsCrawling(false);
          setCrawlProgress('');
          setPage(1);
          const abortParams = new URLSearchParams();
          abortParams.set('page', '1');
          abortParams.set('limit', '12');
          abortParams.set('user_id', user.id);
          if (searchRef.current) abortParams.set('search', searchRef.current);
          if (categoryRef.current) abortParams.set('category', categoryRef.current);
          abortParams.set('_t', Date.now().toString());
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
    try { sessionStorage.removeItem(STORAGE_KEY.MY_ARTICLES); } catch { /* ignore */ }
  }, [language, category]);

  // Show login dialog for unauthenticated users
  if (authChecked && !user) {
    return (
      <div className="min-h-screen">
        <Header language={language} onLanguageChange={setLanguage} />
        <LoginPromptDialog
          isOpen={showLoginDialog}
          onClose={() => router.push('/')}
        />
      </div>
    );
  }

  // Loading auth state
  if (!authChecked) {
    return (
      <div className="min-h-screen">
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-[var(--bg-secondary)] rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-[var(--bg-secondary)] rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        language={language}
        onLanguageChange={setLanguage}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
            userId={user?.id}
          />
        </div>

        <ArticleGrid
          articles={articles}
          language={language}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onDelete={handleArticleDelete}
          onChatReference={isChatOpen ? handleChatReference : undefined}
          onCloseChat={isChatOpen ? () => setIsChatOpen(false) : undefined}
        />
      </main>

      <Footer language={language} />

      {!isChatOpen && (
        <div className="fixed bottom-6 left-0 right-0 z-50 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none">
          <button
            className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 pointer-events-auto"
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
        isLoggedIn={true}
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
