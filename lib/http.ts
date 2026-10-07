/**
 * http.ts — tiny shared helpers for API route handlers.
 */
import { NextResponse } from 'next/server';

/** Standard error envelope: { error: string } with the given status. */
export function errorJson(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Safely parse a JSON request body. Returns the parsed value, or `undefined`
 * when the body is missing/invalid (handler should respond 400).
 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
