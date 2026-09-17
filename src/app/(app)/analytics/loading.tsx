/**
 * Mirrors the real analytics layout — full height, a header strip of stat tiles
 * and filters, then the inbox/detail split. The previous skeleton drew a
 * centred card, so the page visibly jumped into a different shape once it
 * loaded.
 */
export default function AnalyticsLoading() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface">
      <header className="shrink-0 border-b border-outline-variant/10 bg-surface-container-lowest px-4 py-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-3.5">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-surface-container-low" />

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-low px-3.5 py-3"
              >
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-surface-container" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3 w-20 animate-pulse rounded bg-surface-container" />
                  <div className="h-5 w-14 animate-pulse rounded bg-surface-container" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="h-9 w-[13rem] animate-pulse rounded-lg bg-surface-container-low" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-container-low" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-container-low" />
            <div className="h-9 min-w-[11rem] flex-1 animate-pulse rounded-lg bg-surface-container-low sm:max-w-xs" />
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[384px] shrink-0 border-r border-outline-variant/10 bg-surface-container-lowest lg:block">
          <div className="flex items-center justify-between border-b border-outline-variant/10 px-5 py-4">
            <div className="h-4 w-28 animate-pulse rounded bg-surface-container-low" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-surface-container-low" />
          </div>
          <div className="divide-y divide-outline-variant/5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-start gap-4 px-5 py-4">
                <div className="mt-1 h-10 w-10 shrink-0 animate-pulse rounded-xl bg-surface-container-low" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-surface-container-low" />
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-container-low" />
                  <div className="h-3 w-full animate-pulse rounded bg-surface-container-low" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4 bg-surface p-6">
          <div className="h-5 w-48 animate-pulse rounded bg-surface-container-low" />
          <div className="h-3 w-64 animate-pulse rounded bg-surface-container-low" />
          <div className="mt-4 flex-1 animate-pulse rounded-2xl bg-surface-container-low/60" />
        </section>
      </main>
    </div>
  );
}
