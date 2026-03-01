'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Header } from '@/components';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.12, ease: 'easeOut' },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, delay: i * 0.1, ease: 'easeOut' },
  }),
};

const painPoints = [
  {
    emoji: '⏰',
    title: '매일 아침 뉴스 검색 2시간',
    description: '어디서 뭘 봐야 할지 모르겠고, 시간만 흘러간다',
  },
  {
    emoji: '😰',
    title: '"최근 트렌드?" 질문에 멈칫',
    description: '면접관의 업계 질문에 준비 없이 당하는 순간',
  },
  {
    emoji: '📂',
    title: '노션에 쌓아만 두는 스크랩',
    description: '정리는 했는데 활용은 못 하는 스크랩 무덤',
  },
];

const beforeAfter = {
  before: [
    '수동으로 뉴스 사이트 돌아다니며 검색',
    '정리 안 되는 스크랩북',
    '면접에서 "음... 그게..." 버벅',
  ],
  after: [
    '매일 자동으로 업계 브리핑 도착',
    'AI 요약 + 태그로 30초 스캔',
    '"이 기사를 면접에서 이렇게 활용하세요"',
  ],
};

const steps = [
  {
    num: '01',
    emoji: '🏢',
    title: '관심 업종 등록',
    description: 'IT, 금융, 마케팅, 리테일 등 관심 분야를 선택하세요',
  },
  {
    num: '02',
    emoji: '🤖',
    title: '자동 수집 + AI 요약',
    description: '매일 업계 콘텐츠를 수집하고 핵심만 요약해드립니다',
  },
  {
    num: '03',
    emoji: '🎯',
    title: 'AI 면접 코칭',
    description: '"이 기사를 면접에서 어떻게 활용?" AI가 답변 예시를 생성합니다',
  },
];

const features = [
  {
    emoji: '🔍',
    title: '자동 크롤링',
    description: '50+ 비즈니스 소스에서 자동으로 콘텐츠를 수집합니다',
    tag: '자동화',
  },
  {
    emoji: '⚡',
    title: 'AI 요약',
    description: '1줄 요약과 태그로 30초 만에 핵심을 파악하세요',
    tag: 'AI',
  },
  {
    emoji: '🧠',
    title: '면접 코칭',
    description: '기사를 클릭하면 AI가 면접 답변 예시를 생성합니다',
    tag: '코칭',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header logoHref="/landing" />

      {/* Hero */}
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.div
                custom={0}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
                style={{
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent)',
                }}
              >
                🎯 취준생을 위한 업계 브리핑
              </motion.div>

              <motion.h1
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6"
                style={{ color: 'var(--text-primary)' }}
              >
                면접에서 할 말이 없다면
                <br />
                <span style={{ color: 'var(--accent)' }}>
                  준비가 부족한 겁니다
                </span>
              </motion.h1>

              <motion.p
                custom={2}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="text-lg mb-8 max-w-lg"
                style={{ color: 'var(--text-secondary)' }}
              >
                매일 30초, AI가 정리해주는 업계 브리핑으로
                <br className="hidden sm:block" />
                면접 자신감을 채우세요
              </motion.p>

              <motion.div
                custom={3}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
              >
                <Link
                  href="/"
                  className="btn btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
                >
                  무료로 시작하기
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </motion.div>
            </div>

            {/* Briefing Card Mockup */}
            <motion.div
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="hidden lg:block"
            >
              <div className="card p-6 space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    오늘의 브리핑
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    2026.03.02
                  </span>
                </div>

                {[
                  {
                    tag: 'IT',
                    tagBg: '#DBEAFE',
                    tagColor: '#1D4ED8',
                    title: 'AI 에이전트 시장, 2026년 핵심 키워드로 부상',
                    summary: '주요 빅테크 기업들이 AI 에이전트 플랫폼에 집중 투자하며...',
                  },
                  {
                    tag: '금융',
                    tagBg: '#D1FAE5',
                    tagColor: '#047857',
                    title: '디지털 자산 규제 프레임워크 최종안 발표',
                    summary: '금융위원회가 가상자산 투자자 보호를 위한 종합 가이드라인을...',
                  },
                  {
                    tag: '마케팅',
                    tagBg: '#EDE9FE',
                    tagColor: '#6D28D9',
                    title: 'Z세대 소비 트렌드: "가치 소비"에서 "경험 소비"로',
                    summary: 'MZ세대의 소비 패턴이 가치 중심에서 경험 중심으로 전환되고...',
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    className="p-4 rounded-xl border cursor-pointer transition-shadow hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border)',
                    }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + i * 0.15 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: item.tagBg, color: item.tagColor }}
                      >
                        {item.tag}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </h4>
                    <p className="text-xs line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                      {item.summary}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 px-6" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              이런 고민, 하고 계시죠?
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              취업 준비의 가장 큰 병목은 &apos;정보 수집&apos;입니다
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((point, i) => (
              <motion.div
                key={point.title}
                className="card p-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="text-4xl mb-4">{point.emoji}</div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                  {point.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {point.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Before/After */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Insight Hub가 바꿔드립니다
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              className="p-8 rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border)',
              }}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-tertiary)' }}>
                Before
              </h3>
              <ul className="space-y-4">
                {beforeAfter.before.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs"
                      style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                    >
                      ✕
                    </div>
                    <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              className="p-8 rounded-2xl border-2"
              style={{
                backgroundColor: 'rgba(37, 99, 235, 0.03)',
                borderColor: 'rgba(37, 99, 235, 0.2)',
              }}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--accent)' }}>
                After
              </h3>
              <ul className="space-y-4">
                {beforeAfter.after.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs text-white"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      ✓
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-6" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              3단계로 끝나는 면접 준비
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              복잡한 설정 없이, 시작하면 바로 브리핑이 도착합니다
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="relative card p-6"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <span
                  className="text-5xl font-black absolute top-4 right-6"
                  style={{ color: 'rgba(37, 99, 235, 0.08)' }}
                >
                  {step.num}
                </span>
                <div className="text-3xl mb-4">{step.emoji}</div>
                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {step.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              핵심 기능
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              면접관이 묻기 전에 읽어두는 업계 브리핑
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="card p-6 card-hover"
                custom={i}
                variants={scaleIn}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{feature.emoji}</div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {feature.tag}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {feature.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              지금 무료로 시작하세요
            </h2>
            <p className="text-lg mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              매일 30초 투자로 면접 합격률을 높이세요.
              <br />
              모든 기능을 무료로 사용할 수 있습니다.
            </p>
            <Link
              href="/"
              className="btn btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-base"
            >
              무료로 시작하기
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-6 border-t text-center text-sm"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-tertiary)',
        }}
      >
        © 2026 Insight Hub. All rights reserved.
      </footer>
    </div>
  );
}
