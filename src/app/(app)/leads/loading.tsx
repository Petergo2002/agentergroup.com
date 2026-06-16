/**
 * Keeps the leads route visually stable while the authenticated workspace resolves.
 */
export default function LeadsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-8 sm:px-6 lg:px-12 lg:py-12">
      <div className="space-y-4">
        <div className="h-4 w-28 animate-pulse rounded-full bg-surface-container-low" />
        <div className="h-11 w-56 animate-pulse rounded-2xl bg-surface-container-low" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded-full bg-surface-container-low" />
      </div>
      <div className="h-14 animate-pulse rounded-2xl bg-surface-container-low" />
      <div className="overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest">
        <div className="h-14 animate-pulse border-b border-outline-variant/10 bg-surface-container-low" />
        <div className="space-y-px">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[76px] animate-pulse border-b border-outline-variant/10 bg-surface-container-lowest"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
