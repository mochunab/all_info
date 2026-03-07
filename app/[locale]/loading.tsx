import { SkeletonGrid } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shimmer" />
              <div className="space-y-1">
                <div className="h-6 w-32 shimmer rounded" />
                <div className="hidden sm:block h-3 w-48 shimmer rounded" />
              </div>
            </div>
            <div className="h-8 w-32 shimmer rounded-full" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Filter Bar Skeleton */}
        <div className="mb-6 sm:mb-8 space-y-4">
          <div className="h-11 shimmer rounded-lg" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 w-20 shimmer rounded-full" />
            ))}
          </div>
        </div>

        {/* Grid Skeleton */}
        <SkeletonGrid count={6} />
      </main>
    </div>
  );
}
