'use client';

export default function WidgetsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="h-[100px] w-full max-w-md animate-pulse rounded-2xl bg-surface-container-low" />
        <div className="h-[48px] w-[140px] animate-pulse rounded-full bg-surface-container-low" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-low p-5"
          >
            <div className="h-12 w-12 animate-pulse rounded-xl bg-surface-container" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-4 w-32 animate-pulse rounded-lg bg-surface-container" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded-full bg-surface-container" />
          </div>
        ))}
      </div>
    </div>
  );
}
