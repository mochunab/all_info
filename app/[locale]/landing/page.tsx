import type { Metadata } from 'next';
import LandingContent from './LandingContent';
import { buildAlternateLanguages } from '@/lib/hreflang';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: '취준생 면접 준비 AI 코칭',
    description: 'AI가 매일 업계 브리핑을 읽고 면접 답변까지 만들어드립니다. 하루 30초 투자로 면접 합격률을 높이세요.',
    alternates: { canonical: `/${locale}/landing`, languages: buildAlternateLanguages('/landing') },
    openGraph: {
      title: '아카인포 - 나만의 면접 치트키',
      description: '30년이 달라진다, 하루 30초로. AI 업계 브리핑 + 면접 코칭.',
      url: `https://aca-info.com/${locale}/landing`,
    },
  };
}

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
      {
        '@type': 'Question',
        name: '어떤 업계 정보를 볼 수 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '마케팅, 스타트업, IT, 유통 등 다양한 업계의 최신 브리핑을 매일 확인할 수 있습니다.',
        },
      },
      {
        '@type': 'Question',
        name: '매일 업데이트되나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '네, 매일 자동으로 크롤링하고 AI가 핵심만 요약해 브리핑을 제공합니다.',
        },
      },
      {
        '@type': 'Question',
        name: 'AI 면접 코칭은 어떻게 작동하나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '수집된 아티클을 기반으로 AI 채팅을 통해 면접 예상 질문과 답변을 생성해드립니다.',
        },
      },
      {
        '@type': 'Question',
        name: '모바일에서도 사용할 수 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '반응형 웹으로 제작되어 PC, 태블릿, 스마트폰 등 모든 기기에서 사용 가능합니다.',
        },
      },
      {
        '@type': 'Question',
        name: '회원가입이 필요한가요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '비로그인으로도 브리핑 열람이 가능하며, 마이피드 등 개인화 기능은 회원가입이 필요합니다.',
        },
      },
      {
        '@type': 'Question',
        name: '내가 원하는 소스를 추가할 수 있나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '마이피드에서 원하는 웹사이트 URL을 등록하면 자동으로 크롤링되어 브리핑이 제공됩니다.',
        },
      },
      {
        '@type': 'Question',
        name: '데이터는 얼마나 자주 갱신되나요?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '매일 오전 9시(KST)에 자동 갱신되며, 마이피드에서는 수동 새로고침도 가능합니다.',
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
