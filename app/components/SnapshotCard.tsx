'use client';
import { useState } from 'react';
import Link from 'next/link';
import { saveProduct } from '../lib/api';
import { formatCount, formatPrice } from '../lib/format';
import type { ProductSnapshot } from '../lib/types';
import { useToast } from './Toast';
import Stars from './Stars';
import MarketplaceBadge from './MarketplaceBadge';
import Thumb from './Thumb';

/**
 * Snapshot card shown after a successful /api/analyze call.
 * Ephemeral: nothing is persisted until the user clicks Save.
 */
export default function SnapshotCard({ snapshot }: { snapshot: ProductSnapshot }) {
  const toast = useToast();
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      // Free-text tags: split on commas, normalize, de-dupe (backend creates missing tags)
      const tags = [
        ...new Set(
          tagInput
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        ),
      ];
      await saveProduct({
        url: snapshot.url,
        marketplace: snapshot.marketplace,
        title: snapshot.title,
        price: snapshot.price,
        currency: snapshot.currency,
        rating: snapshot.rating,
        reviewCount: snapshot.reviewCount,
        monthlySalesEstimate: snapshot.monthlySalesEstimate,
        keywords: snapshot.keywords,
        imageUrl: snapshot.imageUrl,
        tags,
      });
      setSaved(true);
      toast('Saved ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save product');
    } finally {
      setSaving(false);
    }
  };

  const priceLabel =
    snapshot.price != null
      ? `${formatPrice(snapshot.price, snapshot.currency)}${
          snapshot.currency ? ` ${snapshot.currency}` : ''
        }`
      : 'Price unavailable';

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        <Thumb
          src={snapshot.imageUrl}
          alt={snapshot.title ?? 'Product image'}
          size={96}
        />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-base font-semibold text-slate-900">
            {snapshot.title ?? 'Untitled product'}
          </h2>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
            <MarketplaceBadge marketplace={snapshot.marketplace} />
            <span>analyzed just now</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-lg font-bold text-slate-900">{priceLabel}</span>
            {snapshot.rating != null && (
              <span className="flex items-center gap-1.5">
                <Stars rating={snapshot.rating} />
                {snapshot.reviewCount != null && (
                  <span className="text-sm text-slate-500">
                    ({formatCount(snapshot.reviewCount)} reviews)
                  </span>
                )}
              </span>
            )}
          </div>
          {/* Est. sales row is hidden entirely when it can't be inferred — never show "0" */}
          {snapshot.monthlySalesEstimate != null && (
            <p className="mt-1.5 text-sm text-slate-600">
              Est. monthly sales:{' '}
              <span className="font-semibold text-slate-800">
                ~{formatCount(snapshot.monthlySalesEstimate)}
              </span>{' '}
              <span className="text-xs text-slate-400" title={snapshot.estimateNote ?? ''}>
                (estimate)
              </span>
            </p>
          )}
          {snapshot.keywords.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Keywords:</span>
              {snapshot.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!saved ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="Add tags, comma separated… (e.g. magnets, home, gift)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save to watchlist'}
            </button>
            <a
              href={snapshot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              View on marketplace ↗
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <Link
            href="/watchlist"
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
          >
            Saved — View in watchlist <span aria-hidden="true">›</span>
          </Link>
        </div>
      )}
    </div>
  );
}
