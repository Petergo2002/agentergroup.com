'use client';

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="h-[140px] w-full max-w-xl animate-pulse rounded-2xl bg-surface-container-low" />
        <div className="h-[48px] w-[140px] animate-pulse rounded-full bg-surface-container-low" />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[132px] animate-pulse rounded-[1.6rem] bg-surface-container-low shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
          />
        ))}
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[110px] animate-pulse rounded-[1.4rem] bg-surface-container-low"
          />
        ))}
      </section>

      <section className="mt-8">
        <div className="h-[400px] animate-pulse rounded-[2rem] bg-surface-container-low" />
      </section>
    </div>
  );
}
