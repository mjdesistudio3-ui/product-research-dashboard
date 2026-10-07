/**
 * Typed client for the ResearchDash API routes.
 * All helpers throw Error(message) on non-2xx responses,
 * using the backend's { error: string } body when present.
 */
import type {
  AnalyticsData,
  Note,
  ProductDetail,
  ProductSnapshot,
  ProductSummary,
} from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  // Guard against non-JSON error pages (e.g. Next.js 500 HTML)
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const analyzeUrl = (url: string) =>
  req<{ snapshot: ProductSnapshot }>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

export const listProducts = (params: { tag?: string; q?: string } = {}) => {
  const sp = new URLSearchParams();
  if (params.tag) sp.set('tag', params.tag);
  if (params.q) sp.set('q', params.q);
  const qs = sp.toString();
  return req<{ products: ProductSummary[] }>(
    `/api/products${qs ? `?${qs}` : ''}`
  );
};

export interface NewProductInput {
  url: string;
  marketplace: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  reviewCount: number | null;
  monthlySalesEstimate: number | null;
  keywords: string[];
  imageUrl: string | null;
  tags: string[];
}

export const saveProduct = (input: NewProductInput) =>
  req<{ product: ProductDetail }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getProduct = (id: string) =>
  req<{ product: ProductDetail }>(
    `/api/products/${encodeURIComponent(id)}`
  );

/** Tags are replaced wholesale — caller sends the full desired array. */
export const updateProductTags = (id: string, tags: string[]) =>
  req<{ product: ProductDetail }>(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ tags }),
  });

export const deleteProduct = (id: string) =>
  req<{ ok: true }>(`/api/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export const addNote = (id: string, body: string) =>
  req<{ note: Note }>(`/api/products/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

export const deleteNote = (noteId: number) =>
  req<{ ok: true }>(`/api/notes/${noteId}`, { method: 'DELETE' });

export const getAnalytics = () => req<AnalyticsData>('/api/analytics');
