import type { Language } from '@/types';

export const translations = {
  ko: {
    // Header
    'header.refresh': '자료 불러오기',
    'header.refreshing': '불러오는 중...',
    'header.crawling': '크롤링 중...',
    'header.updateWaiting': '업데이트 대기중',
    'header.updateToday': '오늘 {time} 업데이트',
    'header.updateDate': '{date} {hour}시 업데이트',

    // FilterBar
    'filter.search': '인사이트 검색...',
    'filter.addSource': '소스 추가하기',
    'filter.totalCount': '총 {count}개의 인사이트',
    'filter.searchResult': '검색 결과: {count}개',
    'filter.allCategory': '전체',

    // ArticleGrid
    'article.noResults': '검색 결과가 없습니다',
    'article.noResultsHint': '다른 키워드로 검색하거나 필터를 변경해보세요.',
    'article.loadMore': '더 보기',
    'article.loading': '로딩 중...',
    'article.translating': 'Translating...',

    // Footer
    'footer.description': '매일 아침 9시, 비즈니스 인사이트가 업데이트됩니다.',

    // Toast
    'toast.crawlSuccess': '{count}개의 새 인사이트를 불러왔습니다.',
    'toast.noNewInsights': '새로운 인사이트가 없습니다.',
    'toast.crawlFailed': '불러오기 실패: {error}',
    'toast.networkError': '네트워크 오류: {error}',
  },
  en: {
    // Header
    'header.refresh': 'Refresh Data',
    'header.refreshing': 'Refreshing...',
    'header.crawling': 'Crawling...',
    'header.updateWaiting': 'Waiting for update',
    'header.updateToday': 'Updated today at {time}',
    'header.updateDate': 'Updated {date} {hour}h',

    // FilterBar
    'filter.search': 'Search insights...',
    'filter.addSource': 'Add Source',
    'filter.totalCount': 'Total {count} insights',
    'filter.searchResult': 'Results: {count}',
    'filter.allCategory': 'All',

    // ArticleGrid
    'article.noResults': 'No results found',
    'article.noResultsHint': 'Try different keywords or change filters.',
    'article.loadMore': 'Load More',
    'article.loading': 'Loading...',
    'article.translating': 'Translating...',

    // Footer
    'footer.description': 'Business insights updated daily at 9 AM KST.',

    // Toast
    'toast.crawlSuccess': 'Loaded {count} new insights.',
    'toast.noNewInsights': 'No new insights available.',
    'toast.crawlFailed': 'Failed: {error}',
    'toast.networkError': 'Network error: {error}',
  },
  ja: {
    // Header
    'header.refresh': 'データ更新',
    'header.refreshing': '更新中...',
    'header.crawling': 'クロール中...',
    'header.updateWaiting': '更新待機中',
    'header.updateToday': '今日 {time} 更新',
    'header.updateDate': '{date} {hour}時 更新',

    // FilterBar
    'filter.search': 'インサイトを検索...',
    'filter.addSource': 'ソース追加',
    'filter.totalCount': '合計 {count} 件',
    'filter.searchResult': '検索結果: {count} 件',
    'filter.allCategory': 'すべて',

    // ArticleGrid
    'article.noResults': '検索結果がありません',
    'article.noResultsHint': '別のキーワードで検索するか、フィルタを変更してください。',
    'article.loadMore': 'もっと見る',
    'article.loading': '読み込み中...',
    'article.translating': '翻訳中...',

    // Footer
    'footer.description': '毎朝9時、ビジネスインサイトが更新されます。',

    // Toast
    'toast.crawlSuccess': '{count} 件の新しいインサイトを取得しました。',
    'toast.noNewInsights': '新しいインサイトはありません。',
    'toast.crawlFailed': '失敗: {error}',
    'toast.networkError': 'ネットワークエラー: {error}',
  },
  zh: {
    // Header
    'header.refresh': '刷新数据',
    'header.refreshing': '刷新中...',
    'header.crawling': '抓取中...',
    'header.updateWaiting': '等待更新',
    'header.updateToday': '今天 {time} 更新',
    'header.updateDate': '{date} {hour}时 更新',

    // FilterBar
    'filter.search': '搜索洞察...',
    'filter.addSource': '添加来源',
    'filter.totalCount': '共 {count} 条洞察',
    'filter.searchResult': '搜索结果：{count} 条',
    'filter.allCategory': '全部',

    // ArticleGrid
    'article.noResults': '未找到结果',
    'article.noResultsHint': '尝试不同的关键词或更改筛选条件。',
    'article.loadMore': '加载更多',
    'article.loading': '加载中...',
    'article.translating': '翻译中...',

    // Footer
    'footer.description': '每天早上9点更新商业洞察。',

    // Toast
    'toast.crawlSuccess': '已加载 {count} 条新洞察。',
    'toast.noNewInsights': '没有新的洞察。',
    'toast.crawlFailed': '失败：{error}',
    'toast.networkError': '网络错误：{error}',
  },
} as const;

export function t(lang: Language, key: string, params?: Record<string, string | number>): string {
  let text: string = translations[lang][key as keyof typeof translations['ko']] || key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v)) as string;
    });
  }

  return text;
}
