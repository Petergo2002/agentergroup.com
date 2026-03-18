'use client';

export default function AnalyticsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 h-[100px] w-full max-w-md animate-pulse rounded-2xl bg-surface-container-low" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[132px] animate-pulse rounded-[1.6rem] bg-surface-container-low shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
          />
        ))}
      </section>

      <section className="mt-8">
        <div className="h-[400px] animate-pulse rounded-[2rem] bg-surface-container-low" />
      </section>
    </div>
  );
}
