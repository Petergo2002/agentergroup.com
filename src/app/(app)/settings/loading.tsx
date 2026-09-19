export default function SettingsLoading() {
  return (
    <div className="app-page">
      <div className="h-[100px] w-full max-w-md animate-skeleton rounded-2xl bg-surface-container-low" />

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[200px] animate-skeleton rounded-[2rem] bg-surface-container-low"
          />
        ))}
      </div>
    </div>
  );
}
