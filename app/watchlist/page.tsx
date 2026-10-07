'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { deleteProduct, listProducts } from '../lib/api';
import { useToast } from '../components/Toast';
import type { ProductSummary } from '../lib/types';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import { CardGridSkeleton } from '../components/Skeletons';

/**
 * Watchlist page. Filters live in the query string (?tag=&q=) so a
 * filtered view is shareable/bookmarkable. Search input is debounced
 * 300ms before being written to the URL (which triggers the fetch).
 */
function WatchlistInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const q = searchParams.get('q') ?? '';
  const tag = searchParams.get('tag') ?? '';

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const [searchInput, setSearchInput] = useState(q);

  // Write a filter param change back to the URL (removes param when null)
  const updateParams = useCallback(
    (updates: { q?: string | null; tag?: string | null }) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) sp.set(key, value);
        else sp.delete(key);
      }
      const qs = sp.toString();
      router.replace(`/watchlist${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Debounce: push the typed query into the URL 300ms after the user stops typing
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchInput !== q) updateParams({ q: searchInput.trim() || null });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, q, updateParams]);

  // Keep the input in sync when the URL changes externally (back/forward nav)
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Fetch the filtered list whenever q/tag change
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    listProducts({ q: q || undefined, tag: tag || undefined })
      .then(({ products }) => {
        if (!cancelled) {
          // Newest first
          setProducts(
            [...products].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
          setStatus('done');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [q, tag]);

  // Tag universe for the filter chips (from the unfiltered list, fetched once)
  useEffect(() => {
    listProducts()
      .then(({ products }) => {
        const tags = new Set<string>();
        products.forEach((p) => p.tags.forEach((t) => tags.add(t)));
        setAllTags([...tags].sort());
      })
      .catch(() => {
        /* non-fatal: chips just stay empty */
      });
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const prev = products;
      const remaining = prev.filter((p) => p.id !== id);
      // Optimistic removal; restore + toast on failure
      setProducts(remaining);
      try {
        await deleteProduct(id);
        // Recompute the chip universe so tags unique to the deleted
        // product don't linger as filters with zero results.
        const tags = new Set<string>();
        remaining.forEach((p) => p.tags.forEach((t) => tags.add(t)));
        setAllTags([...tags].sort());
        toast('Removed');
      } catch (e) {
        setProducts(prev);
        toast(e instanceof Error ? e.message : 'Could not delete product');
      }
    },
    [products, toast]
  );

  const clearFilters = () => {
    setSearchInput('');
    updateParams({ q: null, tag: null });
  };

  const isFiltering = q !== '' || tag !== '';
  const filterSummary = [
    q ? `'${q}'` : null,
    tag ? `tag '${tag}'` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Watchlist{' '}
          {status === 'done' && (
            <span className="text-lg font-medium text-slate-400">
              ({products.length})
            </span>
          )}
        </h1>
        <Link
          href="/"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + Research new
        </Link>
      </div>

      {/* Toolbar: search + tag chips */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:max-w-xs"
          aria-label="Search products"
        />
        {allTags.length > 0 && (
          <div className="chip-row flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => updateParams({ tag: null })}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                tag === ''
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => updateParams({ tag: tag === t ? null : t })}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  tag === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        {status === 'loading' && <CardGridSkeleton />}

        {status === 'error' && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Couldn&apos;t load your watchlist.{' '}
            <button
              onClick={() => window.location.reload()}
              className="font-semibold underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'done' && products.length === 0 && !isFiltering && (
          <EmptyState
            title="No products yet."
            subtitle="Analyze a URL to start building your shortlist."
            action={
              <Link
                href="/"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Analyze a product
              </Link>
            }
          />
        )}

        {status === 'done' && products.length === 0 && isFiltering && (
          <EmptyState
            title={`No products match ${filterSummary}.`}
            subtitle="Try a different search or tag."
            action={
              <button
                onClick={clearFilters}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Clear filters
              </button>
            }
          />
        )}

        {status === 'done' && products.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// useSearchParams requires a Suspense boundary for static prerendering
export default function WatchlistPage() {
  return (
    <Suspense fallback={<CardGridSkeleton />}>
      <WatchlistInner />
    </Suspense>
  );
}
