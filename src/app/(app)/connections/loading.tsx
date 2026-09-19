export default function ConnectionsLoading() {
  return (
    <div className="app-page">
      <div className="h-[100px] w-full max-w-md animate-skeleton rounded-2xl bg-surface-container-low" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-[180px] animate-skeleton rounded-[1.5rem] bg-surface-container-low"
          />
        ))}
      </div>
    </div>
  );
}
