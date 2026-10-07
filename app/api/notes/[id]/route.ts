/**
 * DELETE /api/notes/[id] — remove a note.
 */
import { NextResponse } from 'next/server';
import { deleteNote, NotFoundError } from '@/lib/db';
import { errorJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return errorJson('note not found', 404);
  try {
    deleteNote(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return errorJson('note not found', 404);
    throw err;
  }
}
