# Product Research Dashboard

A small web app for e-commerce sellers. Paste an Etsy or Amazon product URL, get a
snapshot (price, rating, review count, rough monthly-sales estimate, keywords), save
promising products to a tagged watchlist, jot down notes, and compare niches on a
simple analytics page.

## Features (V1)

- **Analyze** — paste a product URL, get an instant snapshot card. Nothing is saved
  until you click *Save to watchlist*.
- **Watchlist** — saved products as cards, with text search and tag-filter chips
  (filters live in the URL, so filtered views are shareable).
- **Product detail** — full snapshot, tag editor (add/remove), notes with add/delete,
  inline-confirm deletes (no modals).
- **Analytics** — KPI strip, average price by tag (CSS bars), rating distribution
  buckets, recent notes linking back to products.
- **Respectful analysis** — reads only public structured data (schema.org JSON-LD),
  checks robots.txt first, one request per analysis. See "How product analysis works".

## Tech stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- API routes as the backend (no separate server)
- better-sqlite3 — zero-config local database, single file
- No auth, no external services, no chart libraries (V1)

## Prerequisites

- Node.js 18+ (`node -v` to check)
- npm (ships with Node)

## Quickstart

```bash
cd product-dashboard
npm install
npm run dev
```

Open http://localhost:3000 — paste a product URL and hit **Analyze**.

The SQLite database file is created automatically on first run (in `./data/`).

## Project structure

```
product-dashboard/
├── app/
│   ├── page.tsx                  # / — URL input → snapshot card → save
│   ├── watchlist/page.tsx        # /watchlist — search + tag filters
│   ├── products/[id]/page.tsx    # /products/[id] — detail, tags, notes
│   ├── analytics/page.tsx        # /analytics — price by tag, rating buckets
│   └── api/
│       ├── analyze/route.ts      # POST — analyze a URL (ephemeral, not saved)
│       ├── products/route.ts     # GET list (?tag= & ?q=) · POST save
│       ├── products/[id]/route.ts# GET · PATCH (tags wholesale) · DELETE
│       ├── products/[id]/notes/route.ts  # POST a note
│       ├── notes/[id]/route.ts   # DELETE a note
│       └── analytics/route.ts    # GET — aggregates for the analytics page
├── lib/
│   ├── db.ts        # SQLite setup + queries (better-sqlite3)
│   └── scrape.ts    # URL → ProductSnapshot (JSON-LD extraction)
├── docs/
│   ├── ux-design.md     # user stories, wireframes, scope decisions
│   └── ARCHITECTURE.md  # system overview + data flows
├── Dockerfile
└── README.md
```

## API reference

All endpoints return JSON. Errors return `{ "error": "<message>" }` with an appropriate
HTTP status (400 validation, 404 not found, 502 upstream fetch failed).

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | `/api/analyze` | `{ "url": "https://…" }` | Snapshot (see below). Not saved. |
| GET | `/api/products` | `?tag=magnets` `?q=mug` (optional) | `{ "products": [{ …snapshot, "tags": ["magnets"], "notesCount": 2 }] }` newest first |
| POST | `/api/products` | `{ "url", "title", "price", "currency", "rating", "reviewCount", "monthlySalesEstimate", "keywords": [], "imageUrl", "marketplace", "tags": ["magnets","gift"] }` | `{ "product": { … } }` (201) |
| GET | `/api/products/[id]` | — | `{ "product": { …snapshot, "tags": [], "notes": [] } }` |
| PATCH | `/api/products/[id]` | `{ "title"?, "tags": ["new","full","list"] }` — tags are replaced wholesale | `{ "product": { … } }` |
| DELETE | `/api/products/[id]` | — | `{ "ok": true }` |
| POST | `/api/products/[id]/notes` | `{ "body": "Thin margins…" }` | `{ "note": { "id", "body", "created_at" } }` (201) |
| DELETE | `/api/notes/[id]` | — | `{ "ok": true }` |
| GET | `/api/analytics` | — | `{ "avgPriceByTag": [{ "tag", "avg", "count" }], "ratingBuckets": [{ "bucket", "count" }], "totals": { "products", "tags", "notes", "avgRating" }, "recentNotes": […] }` |

Validation notes: `url` must be `http(s)`; `price >= 0`; `rating` 0–5. `POST /api/products`
rejects duplicate URLs (409) — analyze first, save once.

## How product analysis works

`POST /api/analyze` → `lib/scrape.ts` → `analyzeProductUrl(url)`:

1. **Validate** — must be an `http(s)` URL. Marketplace is detected from the hostname
   (`etsy.com`, `amazon.*` incl. regional TLDs, else `other`).
2. **robots.txt** — fetched first (5s timeout). If the product path is disallowed for
   `User-agent: *`, analysis stops and returns `error: "blocked by robots.txt"`.
   The page is never fetched in that case.
3. **Single fetch** — exactly one HTTP request per analysis, 10s timeout, desktop
   browser User-Agent, no retries, no concurrency.
4. **JSON-LD extraction** — scans the raw HTML for `application/ld+json` script blocks
   (including nested `@graph`) and reads the `Product` entity: name, `offers.price` /
   `priceCurrency`, `aggregateRating`, image. Summary stats only — no descriptions,
   no review text, no page cloning.
5. **Keywords** — derived from the product title only: lowercased, stopword-filtered,
   top 8 by frequency.
6. **Sales estimate** — `round(reviewCount × 25)` **only when a review count exists**,
   always returned with `estimateNote: "Rough heuristic from review count — not
   verified sales data."` The UI hides the row entirely when it can't be computed.

Every failure path returns a snapshot with `error` set (`invalid URL`, `blocked by
robots.txt`, `fetch blocked`, `fetch timed out`, `no structured data found`) and
nulls elsewhere — the function never throws, so the UI can offer manual entry.

## Known limitations

- **Amazon usually blocks plain fetches** (403/CAPTCHA). When that happens, analyze
  returns an error and the UI offers manual entry. Long-term fix: Amazon Product
  Advertising API.
- **Etsy sometimes omits `aggregateRating`** on a listing — rating shows as "—".
- **Only raw-HTML JSON-LD is parsed** — pages that render data purely via JavaScript
  yield `no structured data found`.
- **Sales estimates are rough heuristics**, not verified data. Never treat them as fact.
- **SQLite is local-only** — the DB file lives next to the app. See deployment notes
  before putting this on a serverless host.

## Deployment

### Option A — Local (recommended for V1)

Same as quickstart. Runs on your machine, data persists in `./data/`.

```bash
cd product-dashboard
npm install
npm run dev        # dev server → http://localhost:3000
# or: npm run build && npm start   # production mode, same URL
```

### Option B — Vercel

```bash
npm i -g vercel
cd product-dashboard
vercel
```

Answer the prompts (defaults are fine). You'll get a live `*.vercel.app` URL.

**Honest caveat — read this before relying on it:** Vercel's serverless functions run
on a read-only filesystem (outside `/tmp`), and instances are ephemeral. The SQLite
file will not persist between requests — your watchlist will appear to work and then
lose data. For anything beyond a demo, swap SQLite for a hosted Postgres:

1. Create a free Postgres (Neon, Supabase, or Vercel Postgres) and copy the
   connection string.
2. In the Vercel dashboard → your project → Settings → Environment Variables, add
   `DATABASE_URL=<connection string>`.
3. Install a serverless Postgres client: `npm install @vercel/postgres`
   (or `@neondatabase/serverless`).
4. Replace the better-sqlite3 calls in `lib/db.ts` with the client. The schema is
   portable — the translation is mechanical:

```sql
-- same tables, Postgres dialect (SERIAL instead of AUTOINCREMENT, etc.)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  marketplace TEXT, title TEXT,
  price REAL, currency TEXT,
  rating REAL, review_count INTEGER,
  monthly_sales_est INTEGER,
  keywords TEXT, image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE tags (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE product_tags (
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

```ts
// lib/db.ts — sketch of the swap (Vercel Postgres)
import { sql } from '@vercel/postgres';
export async function listProducts(tag?: string, q?: string) {
  const rows = await sql`SELECT * FROM products ORDER BY created_at DESC`;
  return rows.rows;
}
```

5. Redeploy: `vercel --prod`.

**Netlify:** not recommended with SQLite — same ephemeral-filesystem problem as
Vercel, and Netlify Functions add extra cold-start friction for better-sqlite3's
native module. Use Option A, C, or the Postgres swap above.

### Option C — Docker (local server / VPS)

A `Dockerfile` and `.dockerignore` are included. The image builds the Next.js app and
mounts `/app/data` as a volume so the SQLite file survives container restarts.

```bash
cd product-dashboard
docker build -t product-dashboard .
docker run -d --name product-dashboard \
  -p 3000:3000 \
  -v product-dashboard-data:/app/data \
  product-dashboard
```

Open http://localhost:3000 (or `http://<your-server-ip>:3000` on a VPS).

```bash
docker logs product-dashboard        # check it's healthy
docker stop product-dashboard        # stop
docker start product-dashboard       # start again — data persists in the volume
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails on better-sqlite3 (Linux) | It needs a compiler: `sudo apt install -y python3 make g++`, then reinstall. Or skip it and use the Docker image. |
| `Port 3000 is already in use` | `PORT=3001 npm run dev` (or stop the other app). |
| Analyze returns `fetch blocked` / `no structured data found` | The site blocked the request (Amazon almost always does). Use the manual-entry path in the UI. |
| Watchlist is empty after redeploying to Vercel | Expected — SQLite doesn't persist on serverless. See Option B's Postgres swap. |
| `SQLITE_CANTOPEN` / DB permission errors | Make sure `./data` exists and is writable by the user running Node. |
| Stale weirdness after pulling new code | `rm -rf .next node_modules && npm install && npm run dev`. |

## V2 roadmap

Deferred from V1 scope (see `docs/ux-design.md` §2), plus new ideas:

- [ ] Auth / multi-user workspaces
- [ ] Price-history tracking + scheduled re-scraping + **price-drop alerts**
- [ ] **CSV export** of the watchlist (and bulk import via CSV / multi-URL paste)
- [ ] Real keyword data (search volume) instead of title-derived keywords
- [ ] Chart library for analytics + drill-down (click a tag → filtered watchlist)
- [ ] Tag rename/merge (fix "gift" vs "gifts" sprawl)
- [ ] Soft-delete / undo toasts instead of irreversible inline-confirm deletes
- [ ] One-click re-analyze to refresh a saved product's snapshot
- [ ] Mobile-friendly layouts
- [ ] Editable snapshot fields (title/price override) and custom thumbnails
