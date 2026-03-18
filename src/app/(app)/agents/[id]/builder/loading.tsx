'use client';

export default function BuilderLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] w-full">
      <aside className="w-80 border-r border-outline-variant/10 bg-surface-container-lowest p-4">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container" />
          ))}
        </div>
      </aside>

      <main className="flex-1">
        <div className="flex h-full w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-on-surface-variant">Loading builder...</p>
          </div>
        </div>
      </main>

      <aside className="w-80 border-l border-outline-variant/10 bg-surface-container-lowest p-4">
        <div className="h-48 animate-pulse rounded-[1.75rem] bg-surface-container" />
      </aside>
    </div>
  );
}
