"use client";

interface TopbarProps {
  onOpenSidebar?: () => void;
}

export function Topbar({
  onOpenSidebar,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 lg:hidden glass-panel">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          aria-label="Open sidebar"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant transition-all hover:bg-surface-container-highest hover:text-on-surface active:scale-95"
          onClick={onOpenSidebar}
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-primary-container" />
          <span className="font-headline font-bold text-on-surface">Agentergroup</span>
        </div>
      </div>
    </header>
  );
}
