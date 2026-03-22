export default function CategoryLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-2 py-3 md:px-4">
      <div className="h-36 animate-pulse rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)]" />

      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={`skeleton-${idx}`}
          className="animate-pulse rounded-xl border border-[var(--color-line-soft)] bg-[var(--color-bg-surface)] p-3"
        >
          <div className="mb-2 h-4 w-40 rounded bg-[var(--color-bg-elevated)]" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-[var(--color-bg-elevated)]" />
            <div className="h-4 w-[92%] rounded bg-[var(--color-bg-elevated)]" />
            <div className="h-4 w-[74%] rounded bg-[var(--color-bg-elevated)]" />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-24 rounded-full bg-[var(--color-bg-elevated)]" />
            <div className="h-8 w-32 rounded-full bg-[var(--color-bg-elevated)]" />
            <div className="h-8 w-20 rounded-full bg-[var(--color-bg-elevated)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

