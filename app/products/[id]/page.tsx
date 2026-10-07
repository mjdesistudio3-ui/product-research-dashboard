'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  addNote,
  deleteNote,
  deleteProduct,
  getProduct,
  updateProductTags,
} from '../../lib/api';
import { formatCount, formatDate, formatDateTime, formatPrice } from '../../lib/format';
import type { ProductDetail } from '../../lib/types';
import { useToast } from '../../components/Toast';
import Stars from '../../components/Stars';
import MarketplaceBadge from '../../components/MarketplaceBadge';
import Thumb from '../../components/Thumb';
import ConfirmInline from '../../components/ConfirmInline';
import { DetailSkeleton } from '../../components/Skeletons';

/**
 * Product detail: snapshot panel + notes (left), tag editor + danger zone (right).
 * Tags are edited locally and PATCHed wholesale on every add/remove.
 */
export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = params.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const [noteInput, setNoteInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagsBusy, setTagsBusy] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getProduct(id)
      .then(({ product }) => {
        if (!cancelled) {
          setProduct(product);
          setStatus('done');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Send the full tag array; backend replaces wholesale. */
  const persistTags = useCallback(
    async (tags: string[]) => {
      // Serialize: a second add/remove while one is in flight would base its
      // wholesale replacement on stale closure state and silently drop tags.
      if (!product || tagsBusy) return;
      setTagsBusy(true);
      const prev = product.tags;
      setProduct({ ...product, tags }); // optimistic
      try {
        const { product: updated } = await updateProductTags(id, tags);
        setProduct((cur) => (cur ? { ...cur, tags: updated.tags } : cur));
      } catch (e) {
        setProduct({ ...product, tags: prev });
        toast(e instanceof Error ? e.message : 'Could not update tags');
      } finally {
        setTagsBusy(false);
      }
    },
    [id, product, tagsBusy, toast]
  );

  const handleAddTag = () => {
    const name = tagInput.trim().toLowerCase();
    if (!name || !product) return;
    if (product.tags.includes(name)) {
      setTagInput('');
      return;
    }
    setTagInput('');
    persistTags([...product.tags, name]);
  };

  const handleRemoveTag = (name: string) => {
    if (!product) return;
    persistTags(product.tags.filter((t) => t !== name));
  };

  const handleAddNote = async () => {
    const body = noteInput.trim();
    if (!body || !product) return;
    setAddingNote(true);
    try {
      const { note } = await addNote(id, body);
      setProduct({ ...product, notes: [note, ...product.notes] });
      setNoteInput('');
      toast('Note added');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!product) return;
    const prev = product.notes;
    setProduct({ ...product, notes: prev.filter((n) => n.id !== noteId) });
    setDeletingNoteId(null);
    try {
      await deleteNote(noteId);
      toast('Note deleted');
    } catch (e) {
      setProduct({ ...product, notes: prev });
      toast(e instanceof Error ? e.message : 'Could not delete note');
    }
  };

  const handleDeleteProduct = async () => {
    try {
      await deleteProduct(id);
      toast('Product deleted');
      router.push('/watchlist');
    } catch (e) {
      setConfirmingDelete(false);
      toast(e instanceof Error ? e.message : 'Could not delete product');
    }
  };

  if (status === 'loading') {
    return (
      <div>
        <div className="mb-6 h-4 w-40 animate-pulse rounded bg-slate-200" />
        <DetailSkeleton />
      </div>
    );
  }

  if (status === 'error' || !product) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-xl font-bold text-slate-900">Product not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          It may have been deleted.
        </p>
        <Link
          href="/watchlist"
          className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to watchlist
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/watchlist"
        className="mb-6 inline-block text-sm font-medium text-slate-500 hover:text-indigo-600"
      >
        ‹ Back to watchlist
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT: snapshot + notes */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex gap-5">
              <Thumb
                src={product.imageUrl}
                alt={product.title ?? 'Product image'}
                size={160}
              />
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-snug text-slate-900">
                  {product.title ?? 'Untitled product'}
                </h1>
                <p className="mt-1 break-all text-xs text-slate-400">{product.url}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <MarketplaceBadge marketplace={product.marketplace} />
                  <span>added {formatDate(product.createdAt)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatPrice(product.price, product.currency)}
                    {product.currency && product.price != null && (
                      <span className="ml-1 text-sm font-medium text-slate-500">
                        {product.currency}
                      </span>
                    )}
                  </span>
                  {product.rating != null && (
                    <span className="flex items-center gap-1.5">
                      <Stars rating={product.rating} />
                      {product.reviewCount != null && (
                        <span className="text-sm text-slate-500">
                          ({formatCount(product.reviewCount)} reviews)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {product.monthlySalesEstimate != null && (
                  <p className="mt-2 text-sm text-slate-600">
                    Est. monthly sales:{' '}
                    <span className="font-semibold text-slate-800">
                      ~{formatCount(product.monthlySalesEstimate)}
                    </span>{' '}
                    <span className="text-xs text-slate-400">(estimate)</span>
                  </p>
                )}
                {product.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-500">Keywords:</span>
                    {product.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  View original listing ↗
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Notes</h2>
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div>
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !noteInput.trim()}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addingNote ? 'Adding…' : 'Add note'}
                </button>
              </div>
            </div>
            <ul className="mt-4 space-y-3">
              {product.notes.map((note) => (
                <li
                  key={note.id}
                  className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {note.body}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(note.createdAt)}
                    </p>
                  </div>
                  {deletingNoteId === note.id ? (
                    <ConfirmInline
                      onConfirm={() => handleDeleteNote(note.id)}
                      onCancel={() => setDeletingNoteId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setDeletingNoteId(note.id)}
                      title="Delete note"
                      aria-label="Delete note"
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {product.notes.length === 0 && (
              <p className="mt-4 text-sm text-slate-400">
                No notes yet. Jot down why this made your shortlist.
              </p>
            )}
          </section>
        </div>

        {/* RIGHT sidebar: tags + danger zone */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Tags</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-indigo-700"
                >
                  {t}
                  <button
                    onClick={() => handleRemoveTag(t)}
                    disabled={tagsBusy}
                    title={`Remove tag ${t}`}
                    aria-label={`Remove tag ${t}`}
                    className="rounded-full px-1 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-40"
                  >
                    ×
                  </button>
                </span>
              ))}
              {product.tags.length === 0 && (
                <span className="text-sm text-slate-400">No tags yet.</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag();
                }}
                placeholder="New tag…"
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                aria-label="New tag"
              />
              <button
                onClick={handleAddTag}
                disabled={tagsBusy}
                className="shrink-0 rounded-md bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-40"
              >
                {tagsBusy ? '…' : 'Add'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-red-700">Danger zone</h2>
            <div className="mt-3">
              {confirmingDelete ? (
                <ConfirmInline
                  what="Delete this product?"
                  confirmLabel="Delete"
                  onConfirm={handleDeleteProduct}
                  onCancel={() => setConfirmingDelete(false)}
                />
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Delete product
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
