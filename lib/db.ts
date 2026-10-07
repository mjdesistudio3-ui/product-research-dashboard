/**
 * db.ts — better-sqlite3 singleton, schema init, and every SQL query the API
 * routes need. Route handlers stay thin: they validate input, call one of the
 * functions below, and map errors to HTTP status codes.
 *
 * Conventions:
 * - DB rows are snake_case; all functions return camelCase DTOs.
 * - Timestamps are ISO-8601 strings (UTC).
 * - IDs for products are random UUIDs; tags/notes use AUTOINCREMENT ints.
 * - Multi-statement writes run inside transactions so tags/links never
 *   get out of sync with their product.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductRow {
  id: string;
  url: string;
  marketplace: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  review_count: number | null;
  monthly_sales_est: number | null;
  keywords: string; // JSON array stored as TEXT
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteDTO {
  id: number;
  body: string;
  createdAt: string;
}

/** Product shape for list responses (watchlist). */
export interface ProductSummaryDTO {
  id: string;
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
  notesCount: number;
  createdAt: string;
}

/** Product shape for detail responses (includes notes). */
export interface ProductDetailDTO extends Omit<ProductSummaryDTO, 'notesCount'> {
  notes: NoteDTO[];
  updatedAt: string;
}

export interface CreateProductInput {
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

export type RatingBucket = '<3.0' | '3.0-4.0' | '4.0-4.5' | '4.5+';

export interface AnalyticsDTO {
  // currency = the most common currency among the tag's priced products
  // (avg across mixed currencies is approximate; V2 could split by currency).
  avgPriceByTag: { tag: string; avgPrice: number; count: number; currency: string | null }[];
  ratingBuckets: { bucket: RatingBucket; count: number }[];
  totals: { products: number; tags: number; notes: number; avgRating: number | null };
}

// ---------------------------------------------------------------------------
// Errors (route handlers map these to HTTP status codes)
// ---------------------------------------------------------------------------

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

// ---------------------------------------------------------------------------
// Singleton + schema
// ---------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  marketplace TEXT NOT NULL,
  title TEXT,
  price REAL,
  currency TEXT,
  rating REAL,
  review_count INTEGER,
  monthly_sales_est INTEGER,
  keywords TEXT NOT NULL DEFAULT '[]',
  image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS product_tags (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_notes_product ON notes(product_id);
`;

// Survive Next.js dev-server module reloads: keep the connection on globalThis.
const globalForDb = globalThis as unknown as { __prdDb?: Database.Database };

function initDb(): Database.Database {
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true }); // created at runtime; gitignored
  const db = new Database(path.join(dir, 'dashboard.db'));
  db.pragma('journal_mode = WAL'); // concurrent readers; safe for a local dev server
  db.pragma('foreign_keys = ON'); // ON DELETE CASCADE actually fires
  db.exec(SCHEMA);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__prdDb) globalForDb.__prdDb = initDb();
  return globalForDb.__prdDb;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function parseKeywords(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toSummary(row: ProductRow, tags: string[], notesCount: number): ProductSummaryDTO {
  return {
    id: row.id,
    url: row.url,
    marketplace: row.marketplace,
    title: row.title,
    price: row.price,
    currency: row.currency,
    rating: row.rating,
    reviewCount: row.review_count,
    monthlySalesEstimate: row.monthly_sales_est,
    keywords: parseKeywords(row.keywords),
    imageUrl: row.image_url,
    tags,
    notesCount,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Escape LIKE wildcards so a search for "100%" doesn't match everything. */
function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function listProducts(opts: { tag?: string; q?: string }): ProductSummaryDTO[] {
  const db = getDb();
  const tag = opts.tag?.trim().toLowerCase() || null;
  const q = opts.q?.trim() || null;
  const like = q ? `%${escapeLike(q)}%` : null;

  const rows = db
    .prepare(
      `SELECT p.*,
              (SELECT COUNT(*) FROM notes n WHERE n.product_id = p.id) AS notes_count
         FROM products p
        WHERE (@tag IS NULL OR EXISTS (
                SELECT 1 FROM product_tags pt
                JOIN tags t ON t.id = pt.tag_id
                WHERE pt.product_id = p.id AND t.name = @tag))
          AND (@like IS NULL OR p.title LIKE @like ESCAPE '\\' OR p.url LIKE @like ESCAPE '\\')
        ORDER BY p.created_at DESC, p.id DESC`,
    )
    .all({ tag, like }) as (ProductRow & { notes_count: number })[];

  // One query for all tag links (V1 scale: tiny tables), mapped in JS.
  const tagRows = db
    .prepare(
      `SELECT pt.product_id AS productId, t.name AS name
         FROM product_tags pt JOIN tags t ON t.id = pt.tag_id
         ORDER BY t.name`,
    )
    .all() as { productId: string; name: string }[];
  const tagsByProduct = new Map<string, string[]>();
  for (const r of tagRows) {
    const list = tagsByProduct.get(r.productId) ?? [];
    list.push(r.name);
    tagsByProduct.set(r.productId, list);
  }

  return rows.map((r) => toSummary(r, tagsByProduct.get(r.id) ?? [], r.notes_count));
}

export function getProduct(id: string): ProductDetailDTO {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id) as ProductRow | undefined;
  if (!row) throw new NotFoundError('product not found');

  const tagRows = db
    .prepare(
      `SELECT t.name AS name FROM tags t
         JOIN product_tags pt ON pt.tag_id = t.id
        WHERE pt.product_id = ? ORDER BY t.name`,
    )
    .all(id) as { name: string }[];
  const noteRows = db
    // Newest first — matches the frontend, which prepends freshly added notes.
    .prepare(`SELECT * FROM notes WHERE product_id = ? ORDER BY created_at DESC, id DESC`)
    .all(id) as { id: number; body: string; created_at: string }[];

  const { notesCount: _omitted, ...summary } = toSummary(
    row,
    tagRows.map((t) => t.name),
    noteRows.length,
  );
  void _omitted;
  return {
    ...summary,
    notes: noteRows.map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at })),
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Insert the tag if missing, return its id. */
function ensureTagId(db: Database.Database, name: string): number {
  db.prepare(`INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING`).run(name);
  const row = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(name) as { id: number };
  return row.id;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export function createProduct(input: CreateProductInput): ProductDetailDTO {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO products
         (id, url, marketplace, title, price, currency, rating, review_count,
          monthly_sales_est, keywords, image_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.url,
      input.marketplace,
      input.title,
      input.price,
      input.currency,
      input.rating,
      input.reviewCount,
      input.monthlySalesEstimate,
      JSON.stringify(input.keywords),
      input.imageUrl,
      now,
      now,
    );
    const link = db.prepare(`INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)`);
    for (const tag of input.tags) link.run(id, ensureTagId(db, tag));
  });

  try {
    tx();
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('already saved');
    throw err;
  }
  return getProduct(id);
}

/** Remove tag rows that no product references anymore (keeps "Tags used" honest). */
function pruneOrphanTags(db: Database.Database): void {
  db.prepare(
    `DELETE FROM tags
      WHERE NOT EXISTS (
        SELECT 1 FROM product_tags WHERE product_tags.tag_id = tags.id
      )`,
  ).run();
}

/** Replace a product's tags wholesale (delete existing links, insert new). */
export function setProductTags(id: string, tags: string[]): ProductDetailDTO {
  const db = getDb();
  const tx = db.transaction(() => {
    const exists = db.prepare(`SELECT 1 FROM products WHERE id = ?`).get(id);
    if (!exists) throw new NotFoundError('product not found');
    db.prepare(`DELETE FROM product_tags WHERE product_id = ?`).run(id);
    db.prepare(`UPDATE products SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
    const link = db.prepare(`INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)`);
    for (const tag of tags) link.run(id, ensureTagId(db, tag));
    pruneOrphanTags(db);
  });
  tx();
  return getProduct(id);
}

/** Delete cascades to notes + product_tags via foreign keys. */
export function deleteProduct(id: string): void {
  const db = getDb();
  const info = db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  if (info.changes === 0) throw new NotFoundError('product not found');
  pruneOrphanTags(db);
}

export function addNote(productId: string, body: string): NoteDTO {
  const db = getDb();
  const exists = db.prepare(`SELECT 1 FROM products WHERE id = ?`).get(productId);
  if (!exists) throw new NotFoundError('product not found');
  const now = new Date().toISOString();
  const info = db
    .prepare(`INSERT INTO notes (product_id, body, created_at) VALUES (?, ?, ?)`)
    .run(productId, body, now);
  db.prepare(`UPDATE products SET updated_at = ? WHERE id = ?`).run(now, productId);
  return { id: Number(info.lastInsertRowid), body, createdAt: now };
}

export function deleteNote(id: number): void {
  const db = getDb();
  const info = db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  if (info.changes === 0) throw new NotFoundError('note not found');
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

function bucketFor(rating: number): RatingBucket {
  if (rating < 3.0) return '<3.0';
  if (rating < 4.0) return '3.0-4.0';
  if (rating < 4.5) return '4.0-4.5';
  return '4.5+';
}

export function getAnalytics(): AnalyticsDTO {
  const db = getDb();

  // Avg price per tag — only products that have a price; sorted highest first
  // so the CSS bars in the UI read naturally. currency = most common currency
  // among the tag's priced products (approximation when a tag mixes currencies).
  const priceRows = db
    .prepare(
      `SELECT t.name AS tag, AVG(p.price) AS avgPrice, COUNT(*) AS count,
              (SELECT p2.currency
                 FROM products p2
                 JOIN product_tags pt2 ON pt2.product_id = p2.id
                WHERE pt2.tag_id = t.id
                  AND p2.price IS NOT NULL
                  AND p2.currency IS NOT NULL
                GROUP BY p2.currency
                ORDER BY COUNT(*) DESC
                LIMIT 1) AS currency
         FROM tags t
         JOIN product_tags pt ON pt.tag_id = t.id
         JOIN products p ON p.id = pt.product_id
        WHERE p.price IS NOT NULL
        GROUP BY t.id
        ORDER BY avgPrice DESC`,
    )
    .all() as { tag: string; avgPrice: number; count: number; currency: string | null }[];

  const ratingRows = db
    .prepare(`SELECT rating FROM products WHERE rating IS NOT NULL`)
    .all() as { rating: number }[];
  const buckets: Record<RatingBucket, number> = {
    '<3.0': 0,
    '3.0-4.0': 0,
    '4.0-4.5': 0,
    '4.5+': 0,
  };
  let ratingSum = 0;
  for (const r of ratingRows) {
    buckets[bucketFor(r.rating)] += 1;
    ratingSum += r.rating;
  }

  const totals = {
    products: (db.prepare(`SELECT COUNT(*) AS c FROM products`).get() as { c: number }).c,
    tags: (db.prepare(`SELECT COUNT(*) AS c FROM tags`).get() as { c: number }).c,
    notes: (db.prepare(`SELECT COUNT(*) AS c FROM notes`).get() as { c: number }).c,
    avgRating: ratingRows.length > 0 ? Math.round((ratingSum / ratingRows.length) * 100) / 100 : null,
  };

  return {
    avgPriceByTag: priceRows.map((r) => ({
      tag: r.tag,
      avgPrice: Math.round(r.avgPrice * 100) / 100,
      count: r.count,
      currency: r.currency,
    })),
    ratingBuckets: (Object.keys(buckets) as RatingBucket[]).map((bucket) => ({
      bucket,
      count: buckets[bucket],
    })),
    totals,
  };
}
