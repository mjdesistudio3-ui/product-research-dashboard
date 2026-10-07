/** Small display formatters shared across pages. */

export function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price);
  } catch {
    // Unknown/invalid currency code — fall back to a plain dollar string
    return `$${price.toFixed(2)}`;
  }
}

/** 1284 -> "1,284"; 12500 -> "12.5k" (compact card display) */
export function formatCount(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString('en-US');
}

/** "2026-10-07T22:41:00" -> "Oct 7, 22:41" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date}, ${time}`;
}

/** "2026-10-07T22:41:00" -> "Oct 7" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
