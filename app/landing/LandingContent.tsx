'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Header } from '@/components';
import { useLanguage } from '@/lib/language-context';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.12, ease: 'easeOut' as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, delay: i * 0.1, ease: 'easeOut' as const },
  }),
};

const MOCK_CARDS = [
  { tagKey: 'landing.mockTag1', titleKey: 'landing.mockTitle1', descKey: 'landing.mockDesc1', tagBg: '#DBEAFE', tagColor: '#1D4ED8' },
  { tagKey: 'landing.mockTag2', titleKey: 'landing.mockTitle2', descKey: 'landing.mockDesc2', tagBg: '#D1FAE5', tagColor: '#047857' },
  { tagKey: 'landing.mockTag3', titleKey: 'landing.mockTitle3', descKey: 'landing.mockDesc3', tagBg: '#EDE9FE', tagColor: '#6D28D9' },
];

export default function LandingContent() {
  const { language, setLanguage, t } = useLanguage();

  const painPoints = [
    { emoji: '⏰', title: t('landing.pain1'), description: t('landing.pain1d') },
    { emoji: '😰', title: t('landing.pain2'), description: t('landing.pain2d') },
    { emoji: '📂', title: t('landing.pain3'), description: t('landing.pain3d') },
  ];

  const beforeItems = [t('landing.before1'), t('landing.before2'), t('landing.before3')];
  const afterItems = [t('landing.after1'), t('landing.after2'), t('landing.after3')];

  const steps = [
    { num: '01', emoji: '🏢', title: t('landing.step1'), description: t('landing.step1d') },
    { num: '02', emoji: '🤖', title: t('landing.step2'), description: t('landing.step2d') },
    { num: '03', emoji: '🎯', title: t('landing.step3'), description: t('landing.step3d') },
  ];

  const features = [
    { emoji: '🔍', title: t('landing.feat1'), description: t('landing.feat1d'), tag: t('landing.feat1t') },
    { emoji: '⚡', title: t('landing.feat2'), description: t('landing.feat2d'), tag: t('landing.feat2t') },
    { emoji: '🧠', title: t('landing.feat3'), description: t('landing.feat3d'), tag: t('landing.feat3t') },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header logoHref="/landing" language={language} onLanguageChange={setLanguage} />

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
                style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                {t('landing.badge')}
              </motion.div>

              <motion.h1
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('landing.headline1')}
                <br />
                <span style={{ color: 'var(--accent)' }}>
                  {t('landing.headline2')}
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
                {t('landing.sub1')}
                <br className="hidden sm:block" />
                {t('landing.sub2')}
              </motion.p>

              <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
                <Link
                  href="/"
                  className="btn btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
                >
                  {t('landing.cta')}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </motion.div>
            </div>

            {/* Briefing Card Mockup */}
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="hidden lg:block">
              <div className="card p-6 space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t('landing.briefing')}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>2026.03.02</span>
                </div>
                {MOCK_CARDS.map((item, i) => (
                  <motion.div
                    key={item.tagKey}
                    className="p-4 rounded-xl border cursor-pointer transition-shadow hover:shadow-md"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + i * 0.15 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: item.tagBg, color: item.tagColor }}
                      >
                        {t(item.tagKey)}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                      {t(item.titleKey)}
                    </h4>
                    <p className="text-xs line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                      {t(item.descKey)}
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
              {t('landing.painTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('landing.painSub')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {painPoints.map((point, i) => (
              <motion.div
                key={i}
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
              {t('landing.baTitle')}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              className="p-8 rounded-2xl border"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
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
            </motion.div>

            <motion.div
              className="p-8 rounded-2xl border-2"
              style={{ backgroundColor: 'rgba(37, 99, 235, 0.03)', borderColor: 'rgba(37, 99, 235, 0.2)' }}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
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
              {t('landing.howTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('landing.howSub')}
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
              {t('landing.featTitle')}
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('landing.featSub')}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
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
              {t('landing.finalTitle')}
            </h2>
            <p className="text-lg mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {t('landing.finalDesc1')}
              <br />
              {t('landing.finalDesc2')}
            </p>
            <Link
              href="/"
              className="btn btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-base"
            >
              {t('landing.cta')}
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
        style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}
      >
        © 2026 Insight Hub. All rights reserved.
      </footer>
    </div>
  );
}
