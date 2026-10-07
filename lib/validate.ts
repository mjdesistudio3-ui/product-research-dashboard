/**
 * validate.ts — input validation / normalization helpers shared by API routes.
 *
 * Philosophy: be strict on values that corrupt the dataset (URL, price, rating)
 * and lenient-normalizing on free-text affordances (tags, keywords), where we
 * clean and dedupe instead of rejecting the whole request.
 */

/** True when `value` is a well-formed http(s) URL string. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize one tag name: trimmed, lowercased, comma-free (commas are the UI
 * separator), collapsed whitespace. Returns null when the tag is unusable.
 */
export function normalizeTagName(name: string): string | null {
  const t = name.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
  if (t.length < 1 || t.length > 30) return null;
  return t;
}

const MAX_TAGS = 20;

/**
 * Normalize a tags array: keep only valid names, dedupe, cap the count.
 * Non-string entries and invalid names are dropped rather than failing.
 */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const n = normalizeTagName(item);
    if (n && !seen.has(n)) {
      seen.add(n);
      if (seen.size >= MAX_TAGS) break;
    }
  }
  return [...seen];
}

/** Normalize a keywords array: trimmed non-empty strings, deduped, capped. */
export function normalizeKeywords(input: unknown, max = 20): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const k = item.trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      if (seen.size >= max) break;
    }
  }
  return [...seen];
}

/** Finite number >= 0 (prices, counts, estimates). */
export function isNonNegativeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** Finite number in [0, 5] (star ratings). */
export function isRating(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 5;
}

/** Non-negative integer (review counts, sales estimates). */
export function isNonNegativeInt(v: unknown): v is number {
  return isNonNegativeNumber(v) && Number.isInteger(v);
}

export function isMarketplace(v: unknown): v is 'etsy' | 'amazon' | 'other' {
  return v === 'etsy' || v === 'amazon' || v === 'other';
}

/** Optional string field: null/undefined pass through, strings are trimmed. */
export function optString(v: unknown, maxLen = 500): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.slice(0, maxLen) || null;
}
