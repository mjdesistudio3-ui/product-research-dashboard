import type { Marketplace } from '../lib/types';

const STYLES: Record<Marketplace, string> = {
  etsy: 'bg-orange-100 text-orange-700 ring-orange-200',
  amazon: 'bg-slate-200 text-slate-700 ring-slate-300',
  other: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

const LABELS: Record<Marketplace, string> = {
  etsy: 'Etsy',
  amazon: 'Amazon',
  other: 'Web',
};

/** Color-coded marketplace badge (Etsy orange / Amazon blue-gray). */
export default function MarketplaceBadge({
  marketplace,
}: {
  marketplace: Marketplace;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        STYLES[marketplace] ?? STYLES.other
      }`}
    >
      {LABELS[marketplace] ?? LABELS.other}
    </span>
  );
}
