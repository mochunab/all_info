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
    'toast.error': '오류: {error}',
    'toast.articleDeleted': '인사이트가 삭제되었습니다.',
    'toast.deleteFailed': '삭제 실패: {error}',

    // Dialog
    'dialog.confirm': '확인',
    'dialog.cancel': '취소',
    'dialog.deleteArticleTitle': '인사이트 삭제',
    'dialog.deleteArticleMessage': '이 인사이트를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
    'dialog.delete': '삭제',

    // Sources Add Page
    'sources.back': '돌아가기',
    'sources.title': '소스 관리',
    'sources.subtitle': '카테고리별로 크롤링할 웹사이트를 관리하세요.',
    'sources.linkLabel': '출처 링크',
    'sources.urlPlaceholder': 'https://example.com/blog',
    'sources.namePlaceholder': '소스 이름 (선택)',
    'sources.addLink': '링크 추가하기',
    'sources.save': '저장하기',
    'sources.saving': '저장 중...',
    'sources.saved': '저장되었습니다.',
    'sources.deleteCategory': '카테고리 삭제',
    'sources.deleteCategoryConfirm': "'{name}' 카테고리를 삭제하시겠습니까?",
    'sources.deleteWithLinks': '저장한 링크 {count}개가 함께 삭제됩니다.',
    'sources.cancel': '취소',
    'sources.delete': '삭제',
    'sources.deleting': '삭제 중...',
    'sources.categoryDeleted': "'{name}' 카테고리가 삭제되었습니다.",
    'sources.categoryExists': "'{name}' 카테고리가 이미 존재합니다.",
    'sources.autoAnalysis': '{count}개 소스 저장 (자동분석: {methods})',

    // Sources Recommend
    'sources.recommendLink': '콘텐츠 링크 추천받기',
    'sources.recommendScope': '크롤링 범위를 정해주세요',
    'sources.scopeDomestic': '국내만',
    'sources.scopeInternational': '해외만',
    'sources.scopeBoth': '국내 + 해외',
    'sources.recommendLoading': 'AI 콘텐츠 소스 추천 중',
    'sources.recommendLoadingDesc': 'AI가 최적의 콘텐츠 소스를 찾고 있어요',
    'sources.recommendSuccess': '{count}개 콘텐츠 소스가 추천되었습니다',
    'sources.recommendFailed': '추천 실패: {error}',
    'sources.recommendEmpty': '추천된 소스가 없습니다',
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
    'toast.error': 'Error: {error}',
    'toast.articleDeleted': 'Insight deleted successfully.',
    'toast.deleteFailed': 'Delete failed: {error}',

    // Dialog
    'dialog.confirm': 'Confirm',
    'dialog.cancel': 'Cancel',
    'dialog.deleteArticleTitle': 'Delete Insight',
    'dialog.deleteArticleMessage': 'Are you sure you want to delete this insight? This action cannot be undone.',
    'dialog.delete': 'Delete',

    // Sources Add Page
    'sources.back': 'Back',
    'sources.title': 'Source Management',
    'sources.subtitle': 'Manage websites to crawl by category.',
    'sources.linkLabel': 'Source Link',
    'sources.urlPlaceholder': 'https://example.com/blog',
    'sources.namePlaceholder': 'Source name (optional)',
    'sources.addLink': 'Add Link',
    'sources.save': 'Save',
    'sources.saving': 'Saving...',
    'sources.saved': 'Saved successfully.',
    'sources.deleteCategory': 'Delete Category',
    'sources.deleteCategoryConfirm': "Delete '{name}' category?",
    'sources.deleteWithLinks': '{count} saved links will be deleted together.',
    'sources.cancel': 'Cancel',
    'sources.delete': 'Delete',
    'sources.deleting': 'Deleting...',
    'sources.categoryDeleted': "'{name}' category has been deleted.",
    'sources.categoryExists': "Category '{name}' already exists.",
    'sources.autoAnalysis': '{count} sources saved (auto-analysis: {methods})',

    // Sources Recommend
    'sources.recommendLink': 'Get link recommendations',
    'sources.recommendScope': 'Choose crawling scope',
    'sources.scopeDomestic': 'Domestic only',
    'sources.scopeInternational': 'International only',
    'sources.scopeBoth': 'Domestic + International',
    'sources.recommendLoading': 'AI recommending sources',
    'sources.recommendLoadingDesc': 'AI is finding the best content sources',
    'sources.recommendSuccess': '{count} content sources recommended',
    'sources.recommendFailed': 'Recommendation failed: {error}',
    'sources.recommendEmpty': 'No sources recommended',
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
    'toast.error': 'エラー: {error}',
    'toast.articleDeleted': 'インサイトが削除されました。',
    'toast.deleteFailed': '削除失敗: {error}',

    // Dialog
    'dialog.confirm': '確認',
    'dialog.cancel': 'キャンセル',
    'dialog.deleteArticleTitle': 'インサイトを削除',
    'dialog.deleteArticleMessage': 'このインサイトを削除してもよろしいですか？この操作は取り消せません。',
    'dialog.delete': '削除',

    // Sources Add Page
    'sources.back': '戻る',
    'sources.title': 'ソース管理',
    'sources.subtitle': 'カテゴリ別にクロールするウェブサイトを管理します。',
    'sources.linkLabel': 'ソースリンク',
    'sources.urlPlaceholder': 'https://example.com/blog',
    'sources.namePlaceholder': 'ソース名 (任意)',
    'sources.addLink': 'リンクを追加',
    'sources.save': '保存',
    'sources.saving': '保存中...',
    'sources.saved': '保存されました。',
    'sources.deleteCategory': 'カテゴリを削除',
    'sources.deleteCategoryConfirm': "'{name}' カテゴリを削除しますか？",
    'sources.deleteWithLinks': '保存されたリンク {count} 件が一緒に削除されます。',
    'sources.cancel': 'キャンセル',
    'sources.delete': '削除',
    'sources.deleting': '削除中...',
    'sources.categoryDeleted': "'{name}' カテゴリが削除されました。",
    'sources.categoryExists': "カテゴリ '{name}' は既に存在します。",
    'sources.autoAnalysis': '{count} ソース保存 (自動分析: {methods})',

    // Sources Recommend
    'sources.recommendLink': 'リンクをおすすめ',
    'sources.recommendScope': 'クロール範囲を選択してください',
    'sources.scopeDomestic': '国内のみ',
    'sources.scopeInternational': '海外のみ',
    'sources.scopeBoth': '国内 + 海外',
    'sources.recommendLoading': 'AIがソースを推薦中',
    'sources.recommendLoadingDesc': 'AIが最適なコンテンツソースを探しています',
    'sources.recommendSuccess': '{count}件のコンテンツソースが推薦されました',
    'sources.recommendFailed': '推薦失敗: {error}',
    'sources.recommendEmpty': '推薦されたソースがありません',
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
    'toast.error': '错误：{error}',
    'toast.articleDeleted': '洞察已删除。',
    'toast.deleteFailed': '删除失败：{error}',

    // Dialog
    'dialog.confirm': '确认',
    'dialog.cancel': '取消',
    'dialog.deleteArticleTitle': '删除洞察',
    'dialog.deleteArticleMessage': '您确定要删除此洞察吗？此操作无法撤消。',
    'dialog.delete': '删除',

    // Sources Add Page
    'sources.back': '返回',
    'sources.title': '来源管理',
    'sources.subtitle': '按类别管理要抓取的网站。',
    'sources.linkLabel': '来源链接',
    'sources.urlPlaceholder': 'https://example.com/blog',
    'sources.namePlaceholder': '来源名称（可选）',
    'sources.addLink': '添加链接',
    'sources.save': '保存',
    'sources.saving': '保存中...',
    'sources.saved': '已保存。',
    'sources.deleteCategory': '删除类别',
    'sources.deleteCategoryConfirm': "删除 '{name}' 类别？",
    'sources.deleteWithLinks': '将一起删除 {count} 个已保存的链接。',
    'sources.cancel': '取消',
    'sources.delete': '删除',
    'sources.deleting': '删除中...',
    'sources.categoryDeleted': "'{name}' 类别已删除。",
    'sources.categoryExists': "类别 '{name}' 已存在。",
    'sources.autoAnalysis': '{count} 来源已保存（自动分析：{methods}）',

    // Sources Recommend
    'sources.recommendLink': '获取链接推荐',
    'sources.recommendScope': '请选择抓取范围',
    'sources.scopeDomestic': '仅国内',
    'sources.scopeInternational': '仅海外',
    'sources.scopeBoth': '国内 + 海外',
    'sources.recommendLoading': 'AI正在推荐来源',
    'sources.recommendLoadingDesc': 'AI正在寻找最佳内容来源',
    'sources.recommendSuccess': '已推荐{count}个内容来源',
    'sources.recommendFailed': '推荐失败：{error}',
    'sources.recommendEmpty': '没有推荐的来源',
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
