'use client';

import { t } from '@/lib/i18n';
import LocaleLink from '@/components/LocaleLink';
import { useLanguage } from '@/lib/language-context';
import LandingHeader from './LandingHeader';
import AnimatedSection, { AnimatedCard } from './AnimatedSection';

const MOCK_CARDS = [
  { tagKey: 'landing.mockTag1', titleKey: 'landing.mockTitle1', descKey: 'landing.mockDesc1', tagBg: '#DBEAFE', tagColor: '#1D4ED8' },
  { tagKey: 'landing.mockTag2', titleKey: 'landing.mockTitle2', descKey: 'landing.mockDesc2', tagBg: '#D1FAE5', tagColor: '#047857' },
  { tagKey: 'landing.mockTag3', titleKey: 'landing.mockTitle3', descKey: 'landing.mockDesc3', tagBg: '#EDE9FE', tagColor: '#6D28D9' },
] as const;

function IconClock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconFolders() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 17a2 2 0 002-2V9a2 2 0 00-2-2h-3.9a2 2 0 01-1.69-.9l-.81-1.2a2 2 0 00-1.67-.9H8a2 2 0 00-2 2v9a2 2 0 002 2z" />
      <path d="M2 8v11a2 2 0 002 2h14" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  );
}

function IconBot() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44A2.5 2.5 0 015 17.5a2.5 2.5 0 01-.64-4.87A4 4 0 018 7.5a2.5 2.5 0 011.5-5z" />
      <path d="M14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44A2.5 2.5 0 0019 17.5a2.5 2.5 0 00.64-4.87A4 4 0 0016 7.5a2.5 2.5 0 00-1.5-5z" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

const PAIN_ICONS = [IconClock, IconAlertTriangle, IconFolders];
const STEP_ICONS = [IconBuilding, IconBot, IconTarget];
const FEATURE_ICONS = [IconSearch, IconZap, IconBrain];

export default function LandingContent() {
  const { language: lang } = useLanguage();

  const painPoints = [
    { title: t(lang, 'landing.pain1'), description: t(lang, 'landing.pain1d') },
    { title: t(lang, 'landing.pain2'), description: t(lang, 'landing.pain2d') },
    { title: t(lang, 'landing.pain3'), description: t(lang, 'landing.pain3d') },
  ];

  const beforeItems = [t(lang, 'landing.before1'), t(lang, 'landing.before2'), t(lang, 'landing.before3')];
  const afterItems = [t(lang, 'landing.after1'), t(lang, 'landing.after2'), t(lang, 'landing.after3')];

  const steps = [
    { num: '1', title: t(lang, 'landing.step1'), description: t(lang, 'landing.step1d') },
    { num: '2', title: t(lang, 'landing.step2'), description: t(lang, 'landing.step2d') },
    { num: '3', title: t(lang, 'landing.step3'), description: t(lang, 'landing.step3d') },
  ];

  const features = [
    { title: t(lang, 'landing.feat1'), description: t(lang, 'landing.feat1d'), tag: t(lang, 'landing.feat1t') },
    { title: t(lang, 'landing.feat2'), description: t(lang, 'landing.feat2d'), tag: t(lang, 'landing.feat2t') },
    { title: t(lang, 'landing.feat3'), description: t(lang, 'landing.feat3d'), tag: t(lang, 'landing.feat3t') },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <LandingHeader />

      {/* ── Hero ── */}
      <section className="landing-hero-bg pt-32 pb-28 px-6 overflow-hidden relative">
        {/* MD3 organic blur shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div
            className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.15]"
            style={{ backgroundColor: '#2563EB' }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full blur-3xl opacity-[0.08]"
            style={{ backgroundColor: '#3B82F6' }}
          />
          <div
            className="absolute top-1/3 left-1/2 w-[300px] h-[300px] rounded-full blur-3xl opacity-[0.06]"
            style={{ backgroundColor: '#93C5FD' }}
          />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <AnimatedSection
                animation="fadeUp"
                custom={0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium mb-8 cursor-default"
                style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                {t(lang, 'landing.badge')}
              </AnimatedSection>

              <AnimatedSection animation="fadeUp" custom={1}>
                <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold leading-[1.15] mb-6" style={{ color: 'var(--text-primary)' }}>
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
                className="text-lg mb-10 max-w-lg"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}
              >
                {t(lang, 'landing.sub1')}
                <br className="hidden sm:block" />
                {t(lang, 'landing.sub2')}
              </AnimatedSection>

              <AnimatedSection animation="fadeUp" custom={3}>
                <LocaleLink
                  href="/"
                  className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-medium
                    rounded-full text-white
                    active:scale-95
                    shadow-md hover:shadow-lg
                    transition-all duration-300 cursor-pointer relative z-10"
                  style={{
                    backgroundColor: 'var(--accent)',
                    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                >
                  {t(lang, 'landing.cta')}
                  <IconArrowRight />
                </LocaleLink>
              </AnimatedSection>
            </div>

            {/* Preview card — glass-morphism */}
            <AnimatedSection animation="fadeUp" custom={2} className="hidden lg:block">
              <div className="landing-glass rounded-[32px] p-7 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t(lang, 'landing.briefing')}
                  </span>
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                  >
                    {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
                  </span>
                </div>
                {MOCK_CARDS.map((item, i) => (
                  <AnimatedCard key={item.tagKey} index={i} delay={0.6}>
                    <div
                      className="group p-4 rounded-2xl cursor-pointer
                        transition-all duration-300
                        hover:shadow-sm active:scale-[0.98]"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-medium px-2.5 py-0.5 rounded-full"
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

      {/* ── Pain Points ── */}
      <section className="py-24 px-6" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="max-w-5xl mx-auto">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.painTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t(lang, 'landing.painSub')}
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((point, i) => {
              const Icon = PAIN_ICONS[i];
              return (
                <AnimatedSection key={i} animation="fadeIn" useViewport custom={i}>
                  <div className="landing-card p-8 text-center group">
                    <div className="landing-icon-box mx-auto mb-6">
                      <Icon />
                    </div>
                    <h3 className="font-bold text-lg mb-3" style={{ color: 'var(--text-primary)' }}>
                      {point.title}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {point.description}
                    </p>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Before / After ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        {/* Subtle organic shape */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute top-0 right-0 w-[350px] h-[350px] rounded-full blur-3xl opacity-[0.05]"
            style={{ backgroundColor: '#2563EB' }}
          />
        </div>

        <div className="max-w-5xl mx-auto relative">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.baTitle')}
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Before — tonal surface, no border */}
            <AnimatedSection
              animation="slideLeft"
              useViewport
              className="landing-card p-8 hover:!transform-none"
            >
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--text-tertiary)' }}>Before</h3>
              <ul className="space-y-5">
                {beforeItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#FEE2E2' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="text-[15px]" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item}</span>
                  </li>
                ))}
              </ul>
            </AnimatedSection>

            {/* After — accent tonal surface, elevated */}
            <AnimatedSection
              animation="slideRight"
              useViewport
              className="rounded-3xl p-8 shadow-md md:-translate-y-2 hover:!transform-none md:hover:!-translate-y-2"
              style={{ backgroundColor: 'var(--accent-light)' }}
            >
              <h3 className="text-lg font-bold mb-6" style={{ color: 'var(--accent)' }}>After</h3>
              <ul className="space-y-5">
                {afterItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-[15px] font-medium" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{item}</span>
                  </li>
                ))}
              </ul>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        {/* Organic blur */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute -bottom-24 left-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-[0.06]"
            style={{ backgroundColor: '#3B82F6' }}
          />
        </div>

        <div className="max-w-5xl mx-auto relative">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.howTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t(lang, 'landing.howSub')}
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <AnimatedSection key={step.num} animation="fadeIn" useViewport custom={i}>
                  <div className="relative landing-card p-8 group">
                    {i < 2 && <div className="landing-connector" />}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="landing-step-num">{step.num}</div>
                      <div className="landing-icon-box">
                        <Icon />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                      {step.title}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {step.description}
                    </p>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute top-1/2 -right-24 w-[350px] h-[350px] rounded-full blur-3xl opacity-[0.06]"
            style={{ backgroundColor: '#2563EB' }}
          />
        </div>

        <div className="max-w-5xl mx-auto relative">
          <AnimatedSection animation="fadeIn" useViewport className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t(lang, 'landing.featTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t(lang, 'landing.featSub')}
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <AnimatedSection
                  key={i}
                  animation="scaleIn"
                  useViewport
                  custom={i}
                >
                  <div className="landing-card p-8 cursor-pointer group">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="landing-icon-box">
                        <Icon />
                      </div>
                      <span
                        className="text-xs font-medium px-3 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                      >
                        {feature.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                      {feature.title}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {feature.description}
                    </p>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection animation="fadeIn" useViewport>
            <div className="landing-cta-section rounded-[48px] px-8 sm:px-12 py-20 text-center relative overflow-hidden shadow-xl">
              {/* MD3 organic blur decorations */}
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
                <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-white/5 blur-xl" />
              </div>
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-5 text-white">
                  {t(lang, 'landing.finalTitle')}
                </h2>
                <p className="text-lg mb-10 max-w-md mx-auto text-blue-100" style={{ lineHeight: 1.7 }}>
                  {t(lang, 'landing.finalDesc1')}
                  <br />
                  {t(lang, 'landing.finalDesc2')}
                </p>
                <LocaleLink
                  href="/"
                  className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-medium
                    rounded-full bg-white text-blue-700
                    hover:bg-gray-50 active:scale-95
                    shadow-lg hover:shadow-xl
                    transition-all duration-300 cursor-pointer relative z-10"
                  style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)' }}
                >
                  {t(lang, 'landing.cta')}
                  <IconArrowRight />
                </LocaleLink>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <footer
        className="py-10 px-6 text-center text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        &copy; 2026 Insight Hub. All rights reserved.
      </footer>
    </div>
  );
}
