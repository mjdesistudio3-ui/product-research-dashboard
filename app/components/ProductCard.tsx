'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { ProductSummary } from '../lib/types';
import { formatCount, formatPrice } from '../lib/format';
import Stars from './Stars';
import Thumb from './Thumb';
import ConfirmInline from './ConfirmInline';

/**
 * Watchlist grid card. The whole card body links to the detail page;
 * the trash icon stops propagation and confirms inline (no modal).
 */
export default function ProductCard({
  product,
  onDelete,
}: {
  product: ProductSummary;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/products/${encodeURIComponent(product.id)}`}
        className="flex flex-1 flex-col"
        aria-label={product.title ?? 'Product details'}
      >
        <div className="flex justify-center">
          <Thumb
            src={product.imageUrl}
            alt={product.title ?? 'Product image'}
            size={128}
            className="!h-32 !w-full"
          />
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-slate-900">
          {product.title ?? 'Untitled product'}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 text-sm">
          <span className="font-bold text-slate-900">
            {formatPrice(product.price, product.currency)}
          </span>
          {product.rating != null && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Stars rating={product.rating} />
              <span>({formatCount(product.reviewCount)})</span>
            </span>
          )}
        </div>
        {product.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <Link
          href={`/products/${encodeURIComponent(product.id)}`}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Details ›
        </Link>
        {confirming ? (
          <ConfirmInline
            onConfirm={() => onDelete(product.id)}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <button
            type="button"
            title="Delete product"
            aria-label={`Delete ${product.title ?? 'product'}`}
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
