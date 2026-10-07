/** Star rating: 5-star bar with fractional fill + numeric value. */
export default function Stars({
  rating,
  className = '',
}: {
  rating: number | null;
  className?: string;
}) {
  if (rating == null) {
    return <span className="text-sm text-slate-400">No rating</span>;
  }
  const pct = Math.min(100, Math.max(0, (rating / 5) * 100));
  return (
    <span
      className={`relative inline-flex items-center leading-none ${className}`}
      title={`${rating} out of 5 stars`}
      aria-label={`${rating} out of 5 stars`}
    >
      <span className="whitespace-nowrap text-slate-300">★★★★★</span>
      {/* Fractional overlay: clipped to rating/5 width */}
      <span
        className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-amber-400"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      >
        ★★★★★
      </span>
      <span className="ml-1.5 text-sm font-medium text-slate-700">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}
