export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div
        className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border)] p-8"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div className="flex justify-center mb-8">
          <div className="h-7 w-20 shimmer rounded" />
        </div>

        <div className="space-y-5">
          <div>
            <div className="h-4 w-12 shimmer rounded mb-1.5" />
            <div className="h-10 shimmer rounded-lg" />
          </div>
          <div>
            <div className="h-4 w-14 shimmer rounded mb-1.5" />
            <div className="h-10 shimmer rounded-lg" />
          </div>
          <div className="h-10 shimmer rounded-lg" />
        </div>

        <div className="flex justify-center mt-6">
          <div className="h-4 w-40 shimmer rounded" />
        </div>
      </div>
    </div>
  );
}
