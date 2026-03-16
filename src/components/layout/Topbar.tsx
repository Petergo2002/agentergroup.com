"use client";

interface TopbarProps {
  onOpenSidebar?: () => void;
}

export function Topbar({
  onOpenSidebar,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-[4.5rem] items-center justify-between border-b border-outline-variant/50 bg-background/78 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          aria-label="Open sidebar"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container-low lg:hidden"
          onClick={onOpenSidebar}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-2 py-1.5 shadow-sm">
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <div className="mx-1 h-4 w-[1px] bg-outline-variant/40"></div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>
        </div>
      </div>
    </header>
  );
}
