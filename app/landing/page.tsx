'use client';

import dynamic from 'next/dynamic';

const LandingContent = dynamic(() => import('./LandingContent'), {
  ssr: false,
  loading: () => <LandingSkeleton />,
});

function LandingSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-8">
              <div className="w-10 h-10 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
              <div className="flex items-center gap-6">
                <div className="w-16 h-5 bg-[var(--bg-secondary)] rounded animate-pulse" />
                <div className="w-20 h-5 bg-[var(--bg-secondary)] rounded animate-pulse" />
              </div>
            </div>
            <div className="w-24 h-8 bg-[var(--bg-secondary)] rounded animate-pulse" />
          </div>
        </div>
      </header>
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="w-40 h-8 bg-[var(--bg-secondary)] rounded-full animate-pulse" />
              <div className="space-y-3">
                <div className="w-3/4 h-10 bg-[var(--bg-secondary)] rounded animate-pulse" />
                <div className="w-1/2 h-10 bg-[var(--bg-secondary)] rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="w-full h-5 bg-[var(--bg-secondary)] rounded animate-pulse" />
                <div className="w-2/3 h-5 bg-[var(--bg-secondary)] rounded animate-pulse" />
              </div>
              <div className="w-40 h-12 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
            </div>
            <div className="hidden lg:block">
              <div className="h-80 bg-[var(--bg-secondary)] rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function LandingPage() {
  return <LandingContent />;
}
