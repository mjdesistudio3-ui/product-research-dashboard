# Architecture — Product Research Dashboard (V1)

Single Next.js 14 app. No separate backend process, no external services, no auth.
The API routes are the backend; better-sqlite3 is the database (one local file).

## System overview

```
┌─────────┐      ┌──────────────────────────────────────────────┐
│ Browser │─────▶│ Next.js (App Router)                         │
└─────────┘      │                                              │
  ▲   │          │  Pages          API routes                   │
  │   │          │   /               POST /api/analyze ──┐      │
  │   │          │   /watchlist      GET/POST /api/products     │
  │   └──────────│   /products/[id]  GET/PATCH/DELETE …        │
                 │   /analytics      GET /api/analytics         │
                 │                     │            │           │
                 │                     ▼            ▼           │
                 │              lib/scrape.ts   lib/db.ts       │
                 │              (fetch +         (better-       │
                 │               JSON-LD parse)   sqlite3)      │
                 │                     │            │           │
                 └─────────────────────┼────────────┼───────────┘
                                       ▼            ▼
                              Etsy/Amazon HTML   ./data/*.db
                              (one request)     (SQLite file)
```

Pages are React Server/Client Components styled with Tailwind. All data access goes
through the API routes — pages never touch the DB or the network directly.

## Data flow: analyze vs save

These are deliberately two separate operations.

**Analyze (ephemeral):**
`/` → `POST /api/analyze {url}` → `analyzeProductUrl()` in `lib/scrape.ts` fetches the
product page once, parses JSON-LD, returns a `ProductSnapshot`. **Nothing is written
to the database.** The snapshot card renders from the response JSON. Refresh the page
and it's gone.

**Save (persisted):**
Snapshot card → `POST /api/products {…snapshot, tags: ["magnets"]}` → `lib/db.ts`
inserts into `products`, creates missing tags (`tags.name` is UNIQUE, so on-the-fly
creation is race-safe), links them via `product_tags`. Returns the saved product;
the UI toasts "Saved ✓".

**Detail page:** `GET /api/products/[id]` joins product + tags + notes in one query.
Tags are edited wholesale: the client keeps the full tag list and `PATCH` sends the
complete new array (`{tags: [...]}`), the server diffs/inserts/deletes link rows.
Notes are append/delete only — no editing in V1.

**Analytics:** `GET /api/analytics` runs aggregate SQL (`AVG(price) GROUP BY tag`,
`COUNT` into rating buckets `<3 / 3–4 / 4–4.5 / 4.5+`, totals, latest 5 notes) and the
page renders them as CSS bars. One request, no client-side computation.

## Key design decisions

**Analyze-before-save keeps the DB clean.** Research is messy — mistyped URLs,
curiosity clicks, duplicate checks. By making analysis ephemeral, the watchlist only
ever contains deliberate saves. Side benefit: the scraper module never needs write
access, which shrinks the blast radius of the one component that touches the open
internet.

**JSON-LD only, never page cloning.** `lib/scrape.ts` reads schema.org structured
data that marketplaces embed for search engines: name, price, rating, review count.
It never extracts descriptions, review text, or images at full resolution, and it
checks robots.txt before fetching. This is summary statistics for research, not
content reproduction — the respectful (and legally boring) end of the spectrum.

**Tags are free-text, replaced wholesale.** No tag admin screen in V1. Typing
"magnets, home" creates missing tags via the UNIQUE constraint. The client owns the
list and PATCH replaces it entirely — simple, idempotent, no ordering bugs. Tag
sprawl ("gift" vs "gifts") is accepted as a V1 tradeoff; rename/merge is a V2 item.

**SQLite via better-sqlite3, synchronous calls.** For a single-user local tool this
is the simplest correct choice: zero config, zero network, transactions are easy.
The cost is deployability — serverless hosts can't persist the file (see README
Option B for the Postgres swap path). The schema uses plain SQL with no SQLite-only
tricks, so the migration is mechanical.

**No client-side state library.** Server Components fetch on the server; the few
interactive islands (URL form, tag inputs, filters) use local `useState`. At this
scale, a store would be pure overhead.
