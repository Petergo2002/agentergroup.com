export default function DashboardLoading() {
  return (
    <div className="app-page animate-skeleton space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-xl bg-surface-container-high/50" />
          <div className="h-4 w-72 rounded-lg bg-surface-container-high/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-xl bg-surface-container-high/40" />
          <div className="h-9 w-32 rounded-xl bg-surface-container-high/40" />
        </div>
      </div>

      {/* Stats Grid Skeleton (6 metric cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 rounded-md bg-surface-container-high/40" />
              <div className="h-4 w-4 rounded-md bg-surface-container-high/30" />
            </div>
            <div className="mt-1 h-7 w-12 rounded-lg bg-surface-container-high/60" />
          </div>
        ))}
      </div>

      {/* Main Content Skeleton (2 Columns) */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: Recent Activity Skeleton */}
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
            <div className="space-y-1.5">
              <div className="h-5 w-36 rounded-lg bg-surface-container-high/50" />
              <div className="h-3 w-52 rounded-md bg-surface-container-high/30" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-surface-container-high/40" />
          </div>
          <div className="divide-y divide-outline-variant/10">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-surface-container-high/40" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 rounded-md bg-surface-container-high/50" />
                    <div className="h-3 w-48 rounded-md bg-surface-container-high/30" />
                  </div>
                </div>
                <div className="h-3 w-16 rounded-md bg-surface-container-high/30" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Overview & Quick Actions Skeleton */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs">
            <div className="h-4 w-28 rounded-md bg-surface-container-high/50" />
            <div className="mt-2 h-3 w-44 rounded-md bg-surface-container-high/30" />
            <div className="mt-4 grid gap-2">
              <div className="h-10 rounded-xl bg-surface-container-low" />
              <div className="h-10 rounded-xl bg-surface-container-low" />
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-surface-container-high/40" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 rounded-md bg-surface-container-high/50" />
                <div className="h-3 w-36 rounded-md bg-surface-container-high/30" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="h-10 rounded-xl bg-surface-container-low" />
              <div className="h-10 rounded-xl bg-surface-container-low" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
