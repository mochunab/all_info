export default function Skeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 sm:p-5 space-y-3">
        {/* Source badge skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-5 w-16 shimmer rounded" />
          <div className="w-7 h-7 shimmer rounded-full" />
        </div>

        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-5 shimmer rounded w-full" />
          <div className="h-5 shimmer rounded w-3/4" />
        </div>

        {/* Summary box skeleton */}
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 space-y-2">
          <div className="h-4 shimmer rounded w-full" />
          <div className="h-4 shimmer rounded w-full" />
          <div className="h-4 shimmer rounded w-4/5" />
        </div>

        {/* Tags skeleton */}
        <div className="flex gap-1.5">
          <div className="h-5 w-16 shimmer rounded" />
          <div className="h-5 w-14 shimmer rounded" />
          <div className="h-5 w-18 shimmer rounded" />
        </div>

        {/* Date skeleton */}
        <div className="pt-2 border-t border-[var(--border)]">
          <div className="h-3 shimmer rounded w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} />
      ))}
    </div>
  );
}
