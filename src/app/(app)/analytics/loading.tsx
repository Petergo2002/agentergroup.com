'use client';

export default function AnalyticsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 h-[96px] w-full max-w-xl animate-pulse rounded-[1.8rem] bg-surface-container-low" />

      <div className="overflow-hidden rounded-[1.8rem] border border-outline-variant/20 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:grid lg:min-h-[calc(100dvh-12rem)] lg:grid-cols-[15rem_24rem_minmax(0,1fr)]">
        <aside className="border-b border-outline-variant/10 p-4 lg:border-b-0 lg:border-r">
          <div className="h-4 w-24 animate-pulse rounded-full bg-surface-container-low" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-2xl bg-surface-container-low"
              />
            ))}
          </div>
        </aside>

        <section className="border-b border-outline-variant/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-outline-variant/10 px-4 py-4 sm:px-5">
            <div className="h-5 w-28 animate-pulse rounded-full bg-surface-container-low" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 animate-pulse rounded-xl bg-surface-container-low"
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 px-3 py-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-surface-container-low"
              />
            ))}
          </div>
        </section>

        <section className="hidden lg:block">
          <div className="border-b border-outline-variant/10 px-5 py-5">
            <div className="h-5 w-44 animate-pulse rounded-full bg-surface-container-low" />
            <div className="mt-4 flex gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-8 w-28 animate-pulse rounded-full bg-surface-container-low"
                />
              ))}
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`h-24 animate-pulse rounded-2xl bg-surface-container-low ${
                  index % 2 === 0 ? "ml-auto max-w-[76%]" : "max-w-[82%]"
                }`}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
