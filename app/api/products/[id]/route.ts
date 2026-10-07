/**
 * /api/products/[id] — single product resource.
 *   GET    → full detail (tags + notes)
 *   PATCH  → replace tags wholesale: { tags: string[] }
 *   DELETE → remove product (cascades to notes + tag links)
 */
import { NextResponse } from 'next/server';
import { deleteProduct, getProduct, NotFoundError, setProductTags } from '@/lib/db';
import { errorJson, readJson } from '@/lib/http';
import { normalizeTags } from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    return NextResponse.json({ product: getProduct(params.id) });
  } catch (err) {
    if (err instanceof NotFoundError) return errorJson('product not found', 404);
    throw err;
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const body = (await readJson(request)) as { tags?: unknown } | undefined;
  // PATCH only supports tag replacement in V1 (snapshot fields are read-only
  // by design — delete + re-save is the workaround).
  if (!body || !Array.isArray(body.tags)) {
    return errorJson('tags array is required', 400);
  }
  try {
    return NextResponse.json({ product: setProductTags(params.id, normalizeTags(body.tags)) });
  } catch (err) {
    if (err instanceof NotFoundError) return errorJson('product not found', 404);
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    deleteProduct(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return errorJson('product not found', 404);
    throw err;
  }
}
