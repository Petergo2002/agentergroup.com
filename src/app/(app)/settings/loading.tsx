'use client';

export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 h-[100px] w-full max-w-md animate-pulse rounded-2xl bg-surface-container-low" />

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[200px] animate-pulse rounded-[2rem] bg-surface-container-low"
          />
        ))}
      </div>
    </div>
  );
}
