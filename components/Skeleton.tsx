export default function Skeleton() {
  return (
    <div className="card overflow-hidden">
      {/* Thumbnail skeleton */}
      <div className="aspect-[16/10] shimmer" />

      {/* Content skeleton */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-5 shimmer rounded w-full" />
          <div className="h-5 shimmer rounded w-3/4" />
        </div>

        {/* Summary skeleton */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 shimmer rounded" />
            <div className="h-4 shimmer rounded flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 shimmer rounded" />
            <div className="h-4 shimmer rounded flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 shimmer rounded" />
            <div className="h-4 shimmer rounded w-4/5" />
          </div>
        </div>

        {/* Meta skeleton */}
        <div className="flex items-center justify-between pt-2">
          <div className="h-3 shimmer rounded w-20" />
          <div className="h-3 shimmer rounded w-16" />
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
