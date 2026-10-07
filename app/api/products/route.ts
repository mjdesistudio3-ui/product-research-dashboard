/**
 * /api/products — watchlist collection.
 *   GET  ?tag=&q=  → filtered product summaries, newest first
 *   POST           → save an analyzed snapshot to the watchlist
 */
import { NextResponse } from 'next/server';
import {
  ConflictError,
  createProduct,
  listProducts,
  type CreateProductInput,
} from '@/lib/db';
import { errorJson, readJson } from '@/lib/http';
import {
  isHttpUrl,
  isMarketplace,
  isNonNegativeInt,
  isNonNegativeNumber,
  isRating,
  normalizeKeywords,
  normalizeTags,
  optString,
} from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const products = listProducts({
    tag: searchParams.get('tag') ?? undefined,
    q: searchParams.get('q') ?? undefined,
  });
  return NextResponse.json({ products });
}

/** Validate the save payload; returns the normalized input or an error message. */
function validateCreate(body: unknown): { input: CreateProductInput } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'request body must be JSON' };
  const b = body as Record<string, unknown>;

  if (!isHttpUrl(b.url)) return { error: 'url must be a valid http(s) URL' };
  if (b.marketplace !== undefined && !isMarketplace(b.marketplace)) {
    return { error: "marketplace must be 'etsy', 'amazon', or 'other'" };
  }
  if (b.price !== undefined && b.price !== null && !isNonNegativeNumber(b.price)) {
    return { error: 'price must be a number >= 0' };
  }
  if (b.rating !== undefined && b.rating !== null && !isRating(b.rating)) {
    return { error: 'rating must be a number between 0 and 5' };
  }
  if (b.reviewCount !== undefined && b.reviewCount !== null && !isNonNegativeInt(b.reviewCount)) {
    return { error: 'reviewCount must be a non-negative integer' };
  }
  if (
    b.monthlySalesEstimate !== undefined &&
    b.monthlySalesEstimate !== null &&
    !isNonNegativeInt(b.monthlySalesEstimate)
  ) {
    return { error: 'monthlySalesEstimate must be a non-negative integer' };
  }
  if (b.imageUrl !== undefined && b.imageUrl !== null && !isHttpUrl(b.imageUrl)) {
    return { error: 'imageUrl must be a valid http(s) URL' };
  }
  const currency = optString(b.currency, 10);

  return {
    input: {
      url: b.url.trim(),
      marketplace: isMarketplace(b.marketplace) ? b.marketplace : 'other',
      title: optString(b.title, 500),
      price: isNonNegativeNumber(b.price) ? b.price : null,
      currency: currency ? currency.toUpperCase() : null,
      rating: isRating(b.rating) ? b.rating : null,
      reviewCount: isNonNegativeInt(b.reviewCount) ? b.reviewCount : null,
      monthlySalesEstimate: isNonNegativeInt(b.monthlySalesEstimate) ? b.monthlySalesEstimate : null,
      keywords: normalizeKeywords(b.keywords),
      imageUrl: isHttpUrl(b.imageUrl) ? b.imageUrl.trim() : null,
      tags: normalizeTags(b.tags),
    },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJson(request);
  const validated = validateCreate(body);
  if ('error' in validated) return errorJson(validated.error, 400);
  try {
    const product = createProduct(validated.input);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    if (err instanceof ConflictError) return errorJson('already saved', 409);
    throw err;
  }
}
