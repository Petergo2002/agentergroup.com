function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-container-high ${className}`} />;
}

export function AdminWorkspaceDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-3xl border border-outline bg-surface p-6 shadow-tactile">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="mt-4 h-8 w-40" />
        <SkeletonBlock className="mt-2 h-4 w-52" />
        <div className="mt-6 space-y-4 border-t border-outline pt-6">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonBlock key={index} className="h-14 w-24" />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="border-b border-outline pb-3">
          <SkeletonBlock className="h-5 w-64" />
        </div>
        <div className="rounded-3xl border border-outline bg-surface p-6 shadow-tactile">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-4 h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
