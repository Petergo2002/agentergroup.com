export default function QuestionsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="h-40 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest skeleton" />
      <div className="h-16 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest skeleton" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[92px] rounded-xl border border-outline-variant/10 bg-surface-container-lowest skeleton"
            />
          ))}
        </div>
        <div className="h-[720px] rounded-2xl border border-outline-variant/15 bg-surface-container-lowest skeleton" />
      </div>
    </div>
  );
}
