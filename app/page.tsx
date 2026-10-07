'use client';
import { useRef, useState } from 'react';
import { analyzeUrl } from './lib/api';
import type { ProductSnapshot } from './lib/types';
import SnapshotCard from './components/SnapshotCard';
import { SnapshotSkeleton } from './components/Skeletons';

const SAMPLES = [
  { label: 'Etsy mug', url: 'https://www.etsy.com/listing/1557182309/handmade-ceramic-coffee-mug' },
  { label: 'Amazon LED strip', url: 'https://www.amazon.com/dp/B0CHXYZ123' },
  { label: 'Etsy tote', url: 'https://www.etsy.com/listing/1722334455/canvas-tote-bag-handmade' },
];

/** Client-side pre-check: must be http(s) and look like Etsy/Amazon. */
function looksLikeProductUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    return host.includes('etsy.') || host.includes('amazon.');
  } catch {
    return false;
  }
}

/** Map analyzer error codes to user-friendly messages. */
function friendlyAnalyzeError(code: string): string {
  switch (code) {
    case 'fetch blocked':
      return "Couldn't fetch this product (the site blocked us). Try another URL.";
    case 'blocked by robots.txt':
      return 'This site disallows automated reads of that page (robots.txt). Try another URL.';
    case 'fetch timed out':
      return 'The request timed out. Try again or use another URL.';
    case 'no structured data found':
      return "Couldn't read product data from that page — it may require JavaScript or block readers.";
    default:
      return code;
  }
}

type Status = 'idle' | 'loading' | 'error' | 'done';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<ProductSnapshot | null>(null);
  // Ref guard (not state): two rapid Enters can fire before the re-render
  // disables the button, which would send duplicate analyze requests.
  const busyRef = useRef(false);

  const analyze = async () => {
    if (busyRef.current) return;
    const trimmed = url.trim();
    if (!looksLikeProductUrl(trimmed)) {
      setError("That URL doesn't look like an Etsy or Amazon product page.");
      setStatus('error');
      return;
    }
    busyRef.current = true;
    setStatus('loading');
    setError('');
    try {
      const { snapshot } = await analyzeUrl(trimmed);
      if (snapshot.error) {
        setError(friendlyAnalyzeError(snapshot.error));
        setStatus('error');
        return;
      }
      setSnapshot(snapshot);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setStatus('error');
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Research a product
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Paste an Etsy or Amazon product URL. Get price, ratings, sales
          estimate, keywords.
        </p>
      </div>

      <div className="mt-6 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') analyze();
          }}
          placeholder="https://www.etsy.com/listing/… or amazon.com/dp/…"
          spellCheck={false}
          className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          aria-label="Product URL"
        />
        <button
          onClick={analyze}
          disabled={status === 'loading'}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' && (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
              />
            </svg>
          )}
          Analyze
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        We read public summary data only. Nothing is saved until you click Save.
      </p>

      {status === 'error' && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {status === 'idle' && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-400">Try:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => setUrl(s.url)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {status === 'loading' && <SnapshotSkeleton />}

      {status === 'done' && snapshot && (
        <SnapshotCard key={snapshot.url} snapshot={snapshot} />
      )}
    </div>
  );
}
