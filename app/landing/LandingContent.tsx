'use client';

import Link from 'next/link';
import { t } from '@/lib/i18n';
import { useLanguage } from '@/lib/language-context';
import LandingHeader from './LandingHeader';
import AnimatedSection, { AnimatedCard } from './AnimatedSection';

const MOCK_CARDS = [
  { tagKey: 'landing.mockTag1', titleKey: 'landing.mockTitle1', descKey: 'landing.mockDesc1', tagBg: '#DBEAFE', tagColor: '#1D4ED8' },
  { tagKey: 'landing.mockTag2', titleKey: 'landing.mockTitle2', descKey: 'landing.mockDesc2', tagBg: '#D1FAE5', tagColor: '#047857' },
  { tagKey: 'landing.mockTag3', titleKey: 'landing.mockTitle3', descKey: 'landing.mockDesc3', tagBg: '#EDE9FE', tagColor: '#6D28D9' },
] as const;

export default function LandingContent() {
  const { language: lang } = useLanguage();

  const painPoints = [
    { emoji: '\u23F0', title: t(lang, 'landing.pain1'), description: t(lang, 'landing.pain1d') },
    { emoji: '\uD83D\uDE30', title: t(lang, 'landing.pain2'), description: t(lang, 'landing.pain2d') },
    { emoji: '\uD83D\uDCC2', title: t(lang, 'landing.pain3'), description: t(lang, 'landing.pain3d') },
  ];

  const beforeItems = [t(lang, 'landing.before1'), t(lang, 'landing.before2'), t(lang, 'landing.before3')];
  const afterItems = [t(lang, 'landing.after1'), t(lang, 'landing.after2'), t(lang, 'landing.after3')];

  const steps = [
    { num: '01', emoji: '\uD83C\uDFE2', title: t(lang, 'landing.step1'), description: t(lang, 'landing.step1d') },
    { num: '02', emoji: '\uD83E\uDD16', title: t(lang, 'landing.step2'), description: t(lang, 'landing.step2d') },
    { num: '03', emoji: '\uD83C\uDFAF', title: t(lang, 'landing.step3'), description: t(lang, 'landing.step3d') },
  ];

  const features = [
    { emoji: '\uD83D\uDD0D', title: t(lang, 'landing.feat1'), description: t(lang, 'landing.feat1d'), tag: t(lang, 'landing.feat1t') },
    { emoji: '\u26A1', title: t(lang, 'landing.feat2'), description: t(lang, 'landing.feat2d'), tag: t(lang, 'landing.feat2t') },
    { emoji: '\uD83E\uDDE0', title: t(lang, 'landing.feat3'), description: t(lang, 'landing.feat3d'), tag: t(lang, 'landing.feat3t') },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <LandingHeader />

      {/* Hero */}
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <AnimatedSection
                animation="fadeUp"
                custom={0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
                style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                {t(lang, 'landing.badge')}
              </AnimatedSection>

              <AnimatedSection
                animation="fadeUp"
                custom={1}
              >
                <h1
                  className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(lang, 'landing.headline1')}
                  <br />
                  <span style={{ color: 'var(--accent)' }}>
                    {t(lang, 'landing.headline2')}
                  </span>
                </h1>
              </AnimatedSection>

              <AnimatedSection
                animation="fadeUp"
                custom={2}
                className="text-lg mb-8 max-w-lg"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(lang, 'landing.sub1')}
                <br className="hidden sm:block" />
                {t(lang, 'landing.sub2')}
              </AnimatedSection>

              <AnimatedSection animation="fadeUp" custom={3}>
                <Link
                  href="/"
                  className="btn btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
                >
                  {t(lang, 'landing.cta')}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </AnimatedSection>
            </div>

            <AnimatedSection animation="fadeUp" custom={2} className="hidden lg:block">
              <div className="card p-6 space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t(lang, 'landing.briefing')}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}</span>
                </div>
                {MOCK_CARDS.map((item, i) => (
                  <AnimatedCard key={item.tagKey} index={i} delay={0.6}>
                    <div
                      className="p-4 rounded-xl border cursor-pointer transition-shadow hover:shadow-md"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: item.tagBg, color: item.tagColor }}
                        >
                          {t(lang, item.tagKey)}
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                        {t(lang, item.titleKey)}
                      </h4>
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t(lang, item.descKey)}
                      </p>
                    </div>
                  </AnimatedCard>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 px-6" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="max-w-5xl mx-auto">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.painTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t(lang, 'landing.painSub')}
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((point, i) => (
              <AnimatedSection key={i} animation="fadeIn" useViewport custom={i}>
                <div className="card p-6 text-center">
                  <div className="text-4xl mb-4">{point.emoji}</div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                    {point.title}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {point.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Before/After */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.baTitle')}
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-8">
            <AnimatedSection
              animation="slideLeft"
              useViewport
              className="p-8 rounded-2xl border"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-tertiary)' }}>Before</h3>
              <ul className="space-y-4">
                {beforeItems.map((item) => (
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
            </AnimatedSection>

            <AnimatedSection
              animation="slideRight"
              useViewport
              className="p-8 rounded-2xl border-2"
              style={{ backgroundColor: 'rgba(37, 99, 235, 0.03)', borderColor: 'rgba(37, 99, 235, 0.2)' }}
            >
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--accent)' }}>After</h3>
              <ul className="space-y-4">
                {afterItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs text-white"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      ✓
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-6" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="max-w-5xl mx-auto">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.howTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t(lang, 'landing.howSub')}
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <AnimatedSection key={step.num} animation="fadeIn" useViewport custom={i}>
                <div className="relative card p-6">
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
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.featTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t(lang, 'landing.featSub')}
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <AnimatedSection
                key={i}
                animation="scaleIn"
                useViewport
                custom={i}
                className="card p-6 card-hover"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{feature.emoji}</div>
                  <span
                    className="badge"
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
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
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatedSection animation="fadeIn" useViewport>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.finalTitle')}
            </h2>
            <p className="text-lg mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {t(lang, 'landing.finalDesc1')}
              <br />
              {t(lang, 'landing.finalDesc2')}
            </p>
            <Link
              href="/"
              className="btn btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-base"
            >
              {t(lang, 'landing.cta')}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <footer
        className="py-8 px-6 border-t text-center text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}
      >
        &copy; 2026 Insight Hub. All rights reserved.
      </footer>
    </div>
  );
}
