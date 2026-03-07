export default function MyFeedLoadingSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
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

      {/* FilterBar skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-10 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
            <div className="w-32 h-10 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-20 h-8 bg-[var(--bg-secondary)] rounded-full animate-pulse" />
            ))}
          </div>
        </div>

        {/* Article grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
