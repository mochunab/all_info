import type { Metadata } from 'next';
import LandingContent from './LandingContent';
import { buildAlternateLanguages } from '@/lib/hreflang';

type LandingMeta = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  appName: string;
  keywords: string[];
};

const LANDING_META: Record<string, LandingMeta> = {
  ko: {
    title: '아카인포 - 면접 준비 & 취업 정보 | AI 업계 트렌드 크롤링',
    description: '면접 예상 질문, 업계 트렌드를 AI가 매일 자동 크롤링하고 요약합니다. 취업 준비부터 면접 질문 대비까지, 마케팅·스타트업·IT 최신 정보를 무료로 받아보세요.',
    ogTitle: '아카인포 - 면접 준비 & 업계 트렌드 AI 요약',
    ogDescription: 'AI가 매일 업계 뉴스를 크롤링하고 핵심만 요약. 면접 준비, 취업 정보를 하루 30초로.',
    appName: '아카인포',
    keywords: ['면접 준비', '면접 예상 질문', '면접 질문', '취업 정보', '취업 사이트', '업계 트렌드', 'AI 크롤링', '웹 크롤링', '데이터 크롤링', 'AI 요약', '뉴스 요약', '비즈니스 인사이트', '아카인포'],
  },
  en: {
    title: 'ACA Info - AI News Crawler & Industry Trend Summary',
    description: 'AI-powered web crawling that delivers daily industry briefings. Stay ahead with auto-summarized marketing, startup, and tech trends. Free business news aggregator.',
    ogTitle: 'ACA Info - AI News Crawler & Daily Business Briefing',
    ogDescription: 'AI crawls and summarizes daily industry news. Free business trend tracker.',
    appName: 'ACA Info',
    keywords: ['AI news crawler', 'web crawling tool', 'industry trends', 'business news aggregator', 'AI summary', 'daily briefing', 'market research tool', 'content curation', 'news scraper', 'ACA Info'],
  },
  zh: {
    title: 'ACA Info - AI新闻爬虫 & 行业趋势每日摘要',
    description: 'AI自动爬取行业资讯并总结要点。每天30秒掌握营销、创业、IT最新趋势。免费商业新闻聚合工具。',
    ogTitle: 'ACA Info - AI行业资讯爬虫 & 每日简报',
    ogDescription: 'AI自动爬取并总结每日行业新闻。免费商业趋势追踪。',
    appName: 'ACA Info',
    keywords: ['AI新闻爬虫', '网页爬虫', '行业趋势', '商业资讯聚合', 'AI摘要', '数据采集', '市场调研工具', '内容策展', 'ACA Info'],
  },
  ja: {
    title: 'ACA Info - AIニュースクローラー & 業界トレンドまとめ',
    description: 'AIが毎日業界ニュースを自動クロール＆要約。マーケティング・スタートアップ・ITの最新トレンドを30秒で把握。無料ビジネスニュースアグリゲーター。',
    ogTitle: 'ACA Info - AIニュースクローラー & 毎日のビジネスブリーフィング',
    ogDescription: 'AIが毎日業界ニュースをクロール＆要約。無料ビジネストレンド追跡ツール。',
    appName: 'ACA Info',
    keywords: ['AIニュースクローラー', 'Webクロール', '業界トレンド', 'ビジネスニュースまとめ', 'AI要約', 'データ収集', '市場調査ツール', 'ニュースアグリゲーター', 'ACA Info'],
  },
  vi: {
    title: 'ACA Info - AI Thu thập Tin tức & Tóm tắt Xu hướng Ngành',
    description: 'AI tự động thu thập tin tức ngành và tóm tắt điểm chính hàng ngày. Cập nhật xu hướng marketing, startup, IT trong 30 giây. Công cụ tổng hợp tin tức miễn phí.',
    ogTitle: 'ACA Info - AI Thu thập & Tóm tắt Tin tức Kinh doanh',
    ogDescription: 'AI tự động thu thập và tóm tắt tin tức ngành hàng ngày. Miễn phí.',
    appName: 'ACA Info',
    keywords: ['AI thu thập tin tức', 'web crawling', 'xu hướng ngành', 'tổng hợp tin tức', 'AI tóm tắt', 'nghiên cứu thị trường', 'công cụ thu thập dữ liệu', 'ACA Info'],
  },
};

type FaqItem = { name: string; text: string };

const FAQ_BY_LOCALE: Record<string, FaqItem[]> = {
  ko: [
    { name: '아카인포는 어떤 서비스인가요?', text: '웹사이트 URL을 등록하면 AI가 자동으로 크롤링하고 핵심만 요약해주는 취업 정보 큐레이션 서비스입니다. 면접 준비에 필요한 업계 트렌드를 매일 받아볼 수 있습니다.' },
    { name: '면접 준비에 어떻게 도움이 되나요?', text: '매일 업계 최신 뉴스를 AI가 자동 크롤링하고 요약해, 면접 예상 질문에 대비할 수 있는 업계 지식을 쌓을 수 있습니다. 면접 질문 답변 시 최신 트렌드를 인용할 수 있어 합격률이 높아집니다.' },
    { name: '어떤 업계 정보를 크롤링하나요?', text: '마케팅, 스타트업, IT, 유통 등 다양한 업계의 웹사이트를 자동 크롤링합니다. 원하는 사이트 URL을 직접 등록하면 맞춤형 데이터 크롤링도 가능합니다.' },
    { name: '비용이 있나요?', text: '모든 기능을 무료로 사용할 수 있습니다. 웹 크롤링, AI 요약, 면접 준비 자료 열람까지 전부 무료입니다.' },
    { name: 'AI 크롤링은 어떻게 작동하나요?', text: '9종의 AI 크롤러가 RSS, 정적 HTML, SPA, API 등 다양한 방식으로 웹사이트를 자동 수집합니다. 매일 오전 자동 크롤링되며, 수동 새로고침도 가능합니다.' },
    { name: '취업 정보 사이트와 뭐가 다른가요?', text: '일반 취업 사이트는 채용 공고 위주인 반면, 아카인포는 업계 트렌드와 인사이트를 AI가 자동 수집·요약합니다. 면접에서 차별화된 답변을 준비하는 데 특화되어 있습니다.' },
  ],
  en: [
    { name: 'What is ACA Info?', text: 'ACA Info is a free AI-powered news crawler that automatically collects and summarizes daily industry briefings from any website you register.' },
    { name: 'How does the AI web crawling work?', text: 'Our 9 types of AI crawlers support RSS, static HTML, SPA, API, and more. Content is automatically crawled daily and summarized by AI into concise briefings.' },
    { name: 'What industries does it cover?', text: 'Marketing, startups, IT, retail, fintech, and more. You can also register any website URL for custom crawling and data collection.' },
    { name: 'Is it free?', text: 'Yes, all features including AI crawling, summarization, and industry trend tracking are completely free.' },
    { name: 'How is this different from a regular news aggregator?', text: 'ACA Info uses AI to crawl websites automatically, extract key insights, and summarize them. Unlike RSS readers, it works with any website — even those without RSS feeds.' },
    { name: 'Can I use it for market research?', text: 'Absolutely. Register competitor websites, industry blogs, or news sources. AI will crawl and summarize the latest content daily, perfect for business intelligence and trend analysis.' },
  ],
  zh: [
    { name: 'ACA Info是什么服务？', text: 'ACA Info是一个免费的AI新闻爬虫工具，自动采集并总结您注册的任何网站的每日行业资讯。' },
    { name: 'AI爬虫是如何工作的？', text: '我们的9种AI爬虫支持RSS、静态HTML、SPA、API等多种方式。内容每天自动爬取并由AI总结为简洁的行业简报。' },
    { name: '覆盖哪些行业？', text: '营销、创业、IT、零售、金融科技等。您还可以注册任何网站URL进行自定义数据采集。' },
    { name: '需要付费吗？', text: '所有功能完全免费，包括AI爬取、自动摘要和行业趋势追踪。' },
    { name: '可以用于市场调研吗？', text: '当然可以。注册竞品网站、行业博客或新闻源，AI每天自动爬取并总结最新内容，适合商业情报和趋势分析。' },
  ],
  ja: [
    { name: 'ACA Infoとは？', text: 'ACA Infoは無料のAIニュースクローラーです。登録したWebサイトから毎日自動的にコンテンツを収集し、AIが要約します。' },
    { name: 'AIクロールはどう動きますか？', text: '9種類のAIクローラーがRSS、静的HTML、SPA、APIなど様々な方式でWebサイトを自動収集。毎日自動クロールし、AIが簡潔なブリーフィングに要約します。' },
    { name: 'どの業界をカバーしていますか？', text: 'マーケティング、スタートアップ、IT、小売、フィンテックなど。任意のWebサイトURLを登録してカスタムクロールも可能です。' },
    { name: '料金はかかりますか？', text: 'AIクロール、自動要約、業界トレンド追跡まですべて無料でご利用いただけます。' },
    { name: '市場調査に使えますか？', text: 'もちろんです。競合サイト、業界ブログ、ニュースソースを登録すれば、AIが毎日最新情報をクロール＆要約。ビジネスインテリジェンスやトレンド分析に最適です。' },
  ],
  vi: [
    { name: 'ACA Info là gì?', text: 'ACA Info là công cụ thu thập tin tức bằng AI miễn phí, tự động crawl và tóm tắt bản tin ngành từ bất kỳ website nào bạn đăng ký.' },
    { name: 'AI crawl hoạt động như thế nào?', text: '9 loại AI crawler hỗ trợ RSS, HTML tĩnh, SPA, API và nhiều hơn. Nội dung được tự động crawl hàng ngày và tóm tắt bởi AI.' },
    { name: 'Bao gồm những ngành nào?', text: 'Marketing, startup, IT, bán lẻ, fintech và nhiều hơn. Bạn có thể đăng ký bất kỳ URL website nào để thu thập dữ liệu tùy chỉnh.' },
    { name: 'Có miễn phí không?', text: 'Tất cả tính năng đều miễn phí, bao gồm AI crawling, tóm tắt tự động và theo dõi xu hướng ngành.' },
    { name: 'Có thể dùng để nghiên cứu thị trường không?', text: 'Hoàn toàn có thể. Đăng ký website đối thủ, blog ngành hoặc nguồn tin tức. AI sẽ tự động crawl và tóm tắt nội dung mới nhất hàng ngày.' },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = LANDING_META[locale] || LANDING_META.en;
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: `/${locale}/landing`, languages: buildAlternateLanguages('/landing') },
    openGraph: {
      title: meta.ogTitle,
      description: meta.ogDescription,
      url: `https://aca-info.com/${locale}/landing`,
      siteName: meta.appName,
      type: 'website',
    },
  };
}

function buildJsonLd(locale: string) {
  const meta = LANDING_META[locale] || LANDING_META.en;
  const faqs = FAQ_BY_LOCALE[locale] || FAQ_BY_LOCALE.en;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.name,
        acceptedAnswer: { '@type': 'Answer', text: faq.text },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: meta.appName,
      applicationCategory: 'BusinessApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      operatingSystem: 'Web',
    },
  ];
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const jsonLd = buildJsonLd(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingContent />
    </>
  );
}
