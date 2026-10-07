'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnalytics, listProducts } from '../lib/api';
import type { AnalyticsData, ProductSummary } from '../lib/types';
import { formatPrice } from '../lib/format';
import EmptyState from '../components/EmptyState';

/**
 * Analytics: KPI strip + avg price by tag (CSS bars) + rating buckets.
 * DEVIATION from the wireframe: the "Recent notes" panel is replaced by
 * "Most-noted products" (top 5 by note count, linking to detail pages).
 * Reason: GET /api/analytics has no notes list, and fetching every
 * product's notes would be N+1 requests. notesCount is already on the
 * product summary, so this needs just one extra list call.
 */
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [mostNoted, setMostNoted] = useState<ProductSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAnalytics(), listProducts()])
      .then(([analytics, { products }]) => {
        if (cancelled) return;
        setData(analytics);
        setMostNoted(
          products
            .filter((p) => p.notesCount > 0)
            .sort((a, b) => b.notesCount - a.notesCount)
            .slice(0, 5)
        );
        setStatus('done');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="animate-pulse space-y-6" aria-label="Loading">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="h-56 rounded-xl bg-slate-200" />
        <div className="h-40 rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        Couldn&apos;t load analytics.{' '}
        <button
          onClick={() => window.location.reload()}
          className="font-semibold underline hover:text-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  const { totals, avgPriceByTag, ratingBuckets } = data;

  if (totals.products === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
        <div className="mt-6">
          <EmptyState
            title="Nothing to analyze yet."
            subtitle="Save some products to your watchlist and come back for pricing benchmarks."
            action={
              <Link
                href="/"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Analyze a product
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const maxAvg = Math.max(...avgPriceByTag.map((t) => t.avgPrice), 0);
  const maxBucket = Math.max(...ratingBuckets.map((b) => b.count), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
      <p className="mt-1 text-sm text-slate-500">
        Based on {totals.products} saved product{totals.products === 1 ? '' : 's'} ·
        updated live
      </p>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Products tracked" value={String(totals.products)} />
        <KpiCard label="Tags used" value={String(totals.tags)} />
        <KpiCard label="Notes written" value={String(totals.notes)} />
        <KpiCard
          label="Avg rating"
          value={totals.avgRating != null ? totals.avgRating.toFixed(1) : '—'}
        />
      </div>

      {/* Avg price by tag */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Avg price by tag</h2>
        {avgPriceByTag.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Save products with tags to see price benchmarks per niche.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {avgPriceByTag.map(({ tag, avgPrice, count, currency }) => (
              <li key={tag} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {tag}
                </span>
                <span className="w-20 shrink-0 text-sm font-semibold text-slate-800">
                  {formatPrice(avgPrice, currency)}
                </span>
                <span className="w-10 shrink-0 text-xs text-slate-400">n={count}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full bg-indigo-500"
                    style={{ width: `${maxAvg > 0 ? (avgPrice / maxAvg) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rating distribution */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Rating distribution</h2>
        {ratingBuckets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No rated products yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {ratingBuckets.map(({ bucket, count }) => (
              <li key={bucket} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-slate-600">
                  <span className="text-amber-400">★</span> {bucket}
                </span>
                <span className="w-10 shrink-0 text-sm font-semibold text-slate-800">
                  {count}
                </span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full bg-amber-400"
                    style={{ width: `${maxBucket > 0 ? (count / maxBucket) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Most-noted products (see deviation note at top of file) */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Most-noted products</h2>
        {mostNoted.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No notes yet — add notes on product pages to see your most-annotated
            picks here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {mostNoted.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${encodeURIComponent(p.id)}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {p.title ?? 'Untitled product'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {p.notesCount} note{p.notesCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">
                    {formatPrice(p.price, p.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
