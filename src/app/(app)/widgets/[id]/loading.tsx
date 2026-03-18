'use client';

export default function WidgetDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[2rem] bg-surface-container-low" />
        ))}
      </div>
    </div>
  );
}
