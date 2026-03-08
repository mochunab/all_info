import type { Metadata } from 'next';
import LandingContent from './LandingContent';
import { buildAlternateLanguages } from '@/lib/hreflang';

type LandingMeta = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  appName: string;
};

const LANDING_META: Record<string, LandingMeta> = {
  ko: {
    title: '아카인포 - AI 비즈니스 인사이트 큐레이션',
    description: 'AI가 매일 업계 브리핑을 읽고 핵심만 요약해드립니다. 마케팅, 스타트업, IT 트렌드를 하루 30초로 파악하세요.',
    ogTitle: '아카인포 - AI 비즈니스 인사이트 큐레이션',
    ogDescription: 'AI가 매일 업계 브리핑을 읽고 핵심만 요약. 하루 30초로 업계 트렌드 파악.',
    appName: '아카인포',
  },
  en: {
    title: 'ACA Info - AI Business Insight Curation',
    description: 'AI reads daily industry briefings and summarizes the key points. Stay on top of marketing, startup, and IT trends in just 30 seconds a day.',
    ogTitle: 'ACA Info - AI Business Insight Curation',
    ogDescription: 'AI-powered daily industry briefings. Stay informed in 30 seconds.',
    appName: 'ACA Info',
  },
  zh: {
    title: 'ACA Info - AI商业洞察策展',
    description: 'AI每天阅读行业简报并总结要点。每天30秒掌握营销、创业和IT趋势。',
    ogTitle: 'ACA Info - AI商业洞察策展',
    ogDescription: 'AI驱动的每日行业简报。30秒掌握最新动态。',
    appName: 'ACA Info',
  },
  ja: {
    title: 'ACA Info - AIビジネスインサイトキュレーション',
    description: 'AIが毎日業界ブリーフィングを読み、要点をまとめます。マーケティング、スタートアップ、ITトレンドを1日30秒で把握。',
    ogTitle: 'ACA Info - AIビジネスインサイトキュレーション',
    ogDescription: 'AI搭載の毎日の業界ブリーフィング。30秒で最新情報をキャッチ。',
    appName: 'ACA Info',
  },
  vi: {
    title: 'ACA Info - AI Tổng hợp Thông tin Kinh doanh',
    description: 'AI đọc bản tin ngành hàng ngày và tóm tắt điểm chính. Nắm bắt xu hướng marketing, startup và IT chỉ trong 30 giây mỗi ngày.',
    ogTitle: 'ACA Info - AI Tổng hợp Thông tin Kinh doanh',
    ogDescription: 'Bản tin ngành hàng ngày do AI tổng hợp. Cập nhật trong 30 giây.',
    appName: 'ACA Info',
  },
};

type FaqItem = { name: string; text: string };

const FAQ_BY_LOCALE: Record<string, FaqItem[]> = {
  ko: [
    { name: '아카인포는 어떤 서비스인가요?', text: 'AI가 매일 업계 브리핑을 수집하고 핵심만 요약해주는 비즈니스 인사이트 큐레이션 서비스입니다.' },
    { name: '어떻게 사용하나요?', text: '관심 업종을 등록하면 매일 자동으로 업계 브리핑이 수집되고, AI가 핵심을 요약해드립니다.' },
    { name: '비용이 있나요?', text: '모든 기능을 무료로 사용할 수 있습니다.' },
    { name: '어떤 업계 정보를 볼 수 있나요?', text: '마케팅, 스타트업, IT, 유통 등 다양한 업계의 최신 브리핑을 매일 확인할 수 있습니다.' },
    { name: '매일 업데이트되나요?', text: '네, 매일 자동으로 크롤링하고 AI가 핵심만 요약해 브리핑을 제공합니다.' },
  ],
  en: [
    { name: 'What is ACA Info?', text: 'ACA Info is an AI-powered business insight curation service that collects and summarizes daily industry briefings.' },
    { name: 'How do I use it?', text: 'Register your industries of interest and receive daily AI-summarized briefings automatically.' },
    { name: 'Is it free?', text: 'Yes, all features are available for free.' },
    { name: 'What industries are covered?', text: 'Marketing, startups, IT, retail, and more — with daily updates from various sources.' },
    { name: 'How often is it updated?', text: 'Content is automatically crawled and summarized by AI every day.' },
  ],
  zh: [
    { name: 'ACA Info是什么服务？', text: 'ACA Info是一个AI驱动的商业洞察策展服务，每天收集并总结行业简报。' },
    { name: '如何使用？', text: '注册您感兴趣的行业，每天自动接收AI总结的简报。' },
    { name: '需要付费吗？', text: '所有功能完全免费。' },
    { name: '覆盖哪些行业？', text: '营销、创业、IT、零售等多个行业，每日更新。' },
    { name: '多久更新一次？', text: '每天自动爬取并由AI总结最新内容。' },
  ],
  ja: [
    { name: 'ACA Infoとは？', text: 'ACA InfoはAIが毎日業界ブリーフィングを収集・要約するビジネスインサイトキュレーションサービスです。' },
    { name: 'どう使いますか？', text: '関心のある業界を登録すると、毎日自動でAIが要約したブリーフィングを受け取れます。' },
    { name: '料金はかかりますか？', text: 'すべての機能を無料でご利用いただけます。' },
    { name: 'どの業界をカバーしていますか？', text: 'マーケティング、スタートアップ、IT、小売など、多様な業界の最新情報を毎日更新。' },
    { name: '更新頻度は？', text: '毎日自動でクロールし、AIが要点を要約して提供します。' },
  ],
  vi: [
    { name: 'ACA Info là gì?', text: 'ACA Info là dịch vụ tổng hợp thông tin kinh doanh do AI điều khiển, thu thập và tóm tắt bản tin ngành hàng ngày.' },
    { name: 'Sử dụng như thế nào?', text: 'Đăng ký ngành quan tâm và nhận bản tin tóm tắt bởi AI tự động hàng ngày.' },
    { name: 'Có miễn phí không?', text: 'Có, tất cả tính năng đều miễn phí.' },
    { name: 'Bao gồm những ngành nào?', text: 'Marketing, startup, IT, bán lẻ và nhiều ngành khác, cập nhật hàng ngày.' },
    { name: 'Cập nhật bao lâu một lần?', text: 'Nội dung được tự động thu thập và tóm tắt bởi AI mỗi ngày.' },
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
    alternates: { canonical: `/${locale}/landing`, languages: buildAlternateLanguages('/landing') },
    openGraph: {
      title: meta.ogTitle,
      description: meta.ogDescription,
      url: `https://aca-info.com/${locale}/landing`,
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
