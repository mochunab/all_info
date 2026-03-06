import type { Metadata } from 'next';
import LandingContent from './LandingContent';
import { buildAlternateLanguages } from '@/lib/hreflang';

export const metadata: Metadata = {
  title: '취준생 면접 준비 AI 코칭',
  description: 'AI가 매일 업계 브리핑을 읽고 면접 답변까지 만들어드립니다. 하루 30초 투자로 면접 합격률을 높이세요.',
  alternates: { canonical: 'https://aca-info.com/landing', languages: buildAlternateLanguages('/landing') },
  openGraph: {
    title: '아카인포 - 나만의 면접 치트키',
    description: '30년이 달라진다, 하루 30초로. AI 업계 브리핑 + 면접 코칭.',
    url: 'https://aca-info.com/landing',
  },
};

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '아카인포는 어떤 서비스인가요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AI가 매일 업계 브리핑을 읽고 면접 답변까지 만들어드리는 취준생 전용 서비스입니다.',
        },
      },
      {
        '@type': 'Question',
        name: '어떻게 사용하나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '관심 업종을 등록하면 매일 자동으로 업계 브리핑이 수집되고, AI 면접 코칭 기능으로 답변 예시를 생성받을 수 있습니다.',
        },
      },
      {
        '@type': 'Question',
        name: '비용이 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '모든 기능을 무료로 사용할 수 있습니다.',
        },
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '아카인포',
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    operatingSystem: 'Web',
  },
];

export default function LandingPage() {
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
