/**
 * POST /api/products/[id]/notes — add a note to a product.
 */
import { NextResponse } from 'next/server';
import { addNote, NotFoundError } from '@/lib/db';
import { errorJson, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

const MAX_NOTE_LEN = 2000;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body = (await readJson(request)) as { body?: unknown } | undefined;
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text) return errorJson('note body is required', 400);
  if (text.length > MAX_NOTE_LEN) {
    return errorJson(`note body must be under ${MAX_NOTE_LEN} characters`, 400);
  }
  try {
    const note = addNote(params.id, text);
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof NotFoundError) return errorJson('product not found', 404);
    throw err;
  }
}
