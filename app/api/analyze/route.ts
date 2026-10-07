/**
 * POST /api/analyze — analyze a product URL and return a snapshot.
 * Never writes to the DB; the frontend saves via POST /api/products.
 */
import { NextResponse } from 'next/server';
import { analyzeProductUrl } from '@/lib/scrape';
import { errorJson, readJson } from '@/lib/http';
import { isHttpUrl } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await readJson(request)) as { url?: unknown } | undefined;
  const url = body?.url;
  if (!isHttpUrl(url)) {
    return errorJson('url must be a valid http(s) URL', 400);
  }
  try {
    // analyzeProductUrl never throws by contract, but guard anyway — a 502
    // here means our analysis pipeline failed, not the user's input.
    const snapshot = await analyzeProductUrl(url);
    return NextResponse.json({ snapshot });
  } catch {
    return errorJson('analysis failed unexpectedly', 502);
  }
}
