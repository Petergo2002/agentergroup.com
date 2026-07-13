'use client';

export default function DashboardLoading() {
  return (
    <div className="app-page">
      <header className="app-section-header">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-2xl">
            <div className="h-7 w-32 animate-pulse rounded-lg bg-surface-container-low" />
            <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded-lg bg-surface-container-low" />
            <div className="mt-3 h-5 w-full max-w-lg animate-pulse rounded-md bg-surface-container-low" />
          </div>
          <div className="flex gap-2">
            <div className="h-11 w-32 animate-pulse rounded-xl bg-surface-container-low" />
            <div className="h-11 w-32 animate-pulse rounded-xl bg-surface-container-low" />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[164px] animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low"
          />
        ))}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="h-[520px] animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low" />
        <section className="flex flex-col gap-6">
          <div className="h-[430px] animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low" />
          <div className="h-[178px] animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-low" />
        </section>
      </div>
    </div>
  );
}
