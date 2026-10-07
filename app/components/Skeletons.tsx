/** Pulsing skeleton blocks for loading states. */

/** Snapshot-card-shaped skeleton (home page loading state). */
export function SnapshotSkeleton() {
  return (
    <div
      className="mt-6 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
      aria-label="Loading"
    >
      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 rounded-md bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="h-4 w-1/3 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-4 h-9 w-full rounded-md bg-slate-200" />
    </div>
  );
}

/** Card-grid skeleton rows (watchlist loading state). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="h-32 rounded-md bg-slate-200" />
          <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-1/3 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

/** Two-column skeleton (product detail loading state). */
export function DetailSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Loading">
      <div className="space-y-6 lg:col-span-2">
        <div className="h-48 rounded-xl bg-slate-200" />
        <div className="h-40 rounded-xl bg-slate-200" />
      </div>
      <div className="h-56 rounded-xl bg-slate-200" />
    </div>
  );
}
