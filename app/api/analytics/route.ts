/**
 * GET /api/analytics — dashboard aggregates over the whole watchlist.
 */
import { NextResponse } from 'next/server';
import { getAnalytics } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getAnalytics());
}
