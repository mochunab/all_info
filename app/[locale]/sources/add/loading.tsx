export default function SourcesLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Back button skeleton */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[var(--bg-secondary)] rounded animate-pulse" />
              <div className="w-12 h-4 bg-[var(--bg-secondary)] rounded animate-pulse" />
            </div>

            {/* Language switcher skeleton */}
            <div className="w-20 h-8 bg-[var(--bg-secondary)] rounded animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Title skeleton */}
        <div className="w-32 h-8 bg-[var(--bg-secondary)] rounded animate-pulse mb-2" />

        {/* Subtitle skeleton */}
        <div className="w-64 h-4 bg-[var(--bg-secondary)] rounded animate-pulse mb-8" />

        {/* Category chips skeleton */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-24 h-10 bg-[var(--bg-secondary)] rounded-full animate-pulse"
              />
            ))}
            {/* Add category button skeleton */}
            <div className="w-10 h-10 bg-[var(--bg-secondary)] rounded-full animate-pulse" />
          </div>
        </div>

        {/* Source links skeleton */}
        <div className="mb-6">
          <div className="w-24 h-4 bg-[var(--bg-secondary)] rounded animate-pulse mb-2" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 h-12 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg animate-pulse" />
                  <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Add link button skeleton */}
          <div className="mt-4 w-full h-12 border-2 border-dashed border-[var(--border)] rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
        </div>
      </main>

      {/* Bottom Save Button skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border)] p-4">
        <div className="max-w-2xl mx-auto">
          <div className="w-full h-14 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
