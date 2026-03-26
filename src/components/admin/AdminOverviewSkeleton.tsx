function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.05] ${className}`} />;
}

export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-4 w-[28rem]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-3xl border border-[#222] bg-[#171717] p-6"
          >
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-5 h-9 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-[#222] bg-[#171717] p-6">
        <div className="grid grid-cols-8 gap-4">
          {Array.from({ length: 8 }, (_, index) => (
            <SkeletonBlock key={index} className="h-3 w-full" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonBlock key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
