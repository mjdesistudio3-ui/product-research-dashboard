'use client';
import { useState } from 'react';
import Link from 'next/link';
import { saveProduct } from '../lib/api';
import { useToast } from './Toast';
import MarketplaceBadge from './MarketplaceBadge';

/**
 * Manual entry fallback shown when /api/analyze can't fetch a product
 * (site blocks automated reads, especially from cloud IPs).
 * Posts straight to /api/products — same shape as a saved snapshot.
 */
function detectMarketplace(raw: string): 'etsy' | 'amazon' | 'other' {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    if (host.includes('etsy.')) return 'etsy';
    if (host.includes('amazon.')) return 'amazon';
  } catch {
    /* fall through to 'other' */
  }
  return 'other';
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'new', 'best', 'top', 'set',
  'lot', 'pack', 'a', 'an', 'of', 'to', 'in', 'on', 'by', 'or',
]);

/** Tiny client-side mirror of the scraper's title keyword extraction. */
function keywordsFromTitle(title: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length > 2 && !STOPWORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
      if (out.length >= 8) break;
    }
  }
  return out;
}

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

export default function ManualEntryCard({ initialUrl }: { initialUrl: string }) {
  const toast = useToast();
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [rating, setRating] = useState('');
  const [reviewCount, setReviewCount] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const marketplace = detectMarketplace(url);

  const handleSave = async () => {
    if (saving || saved) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast('Give the product a title first');
      return;
    }
    let parsedPrice: number | null = null;
    if (price.trim() !== '') {
      parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        toast('Price must be 0 or more');
        return;
      }
    }
    let parsedRating: number | null = null;
    if (rating.trim() !== '') {
      parsedRating = Number(rating);
      if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5) {
        toast('Rating must be between 0 and 5');
        return;
      }
    }
    let parsedReviews: number | null = null;
    if (reviewCount.trim() !== '') {
      parsedReviews = Math.floor(Number(reviewCount));
      if (!Number.isFinite(parsedReviews) || parsedReviews < 0) {
        toast('Review count must be 0 or more');
        return;
      }
    }
    setSaving(true);
    try {
      const tags = [
        ...new Set(
          tagInput
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        ),
      ];
      await saveProduct({
        url: url.trim(),
        marketplace,
        title: cleanTitle,
        price: parsedPrice,
        currency: currency.trim() ? currency.trim().toUpperCase() : null,
        rating: parsedRating,
        reviewCount: parsedReviews,
        monthlySalesEstimate: null,
        keywords: keywordsFromTitle(cleanTitle),
        imageUrl: null,
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

  if (saved) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <Link
          href="/watchlist"
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          Saved — View in watchlist <span aria-hidden="true">›</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Enter details manually
        </h2>
        <MarketplaceBadge marketplace={marketplace} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        The site blocked automatic reading — copy the price, rating and review
        count from the listing page.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className={labelCls} htmlFor="me-url">Product URL</label>
          <input id="me-url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} spellCheck={false} />
        </div>
        <div>
          <label className={labelCls} htmlFor="me-title">Title *</label>
          <input
            id="me-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Handmade ceramic coffee mug"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls} htmlFor="me-price">Price</label>
            <input id="me-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="24.99" inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="me-currency">Currency</label>
            <input id="me-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="me-rating">Rating (0–5)</label>
            <input id="me-rating" value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4.6" inputMode="decimal" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="me-reviews">Review count</label>
          <input id="me-reviews" value={reviewCount} onChange={(e) => setReviewCount(e.target.value)} placeholder="1284" inputMode="numeric" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="me-tags">Tags</label>
          <input
            id="me-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add tags, comma separated… (e.g. magnets, home, gift)"
            className={inputCls}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save to watchlist'}
        </button>
      </div>
    </div>
  );
}
