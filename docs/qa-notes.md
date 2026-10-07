# QA Notes — Product Research Dashboard V1

**Date:** 2026-10-07 · **Reviewer:** QA & iteration workstream
**Scope:** full read of `lib/scrape.ts`, `lib/db.ts`, `lib/validate.ts`, `lib/http.ts`,
all `app/api/**/route.ts`, `app/lib/api.ts`, `app/lib/types.ts`, `app/lib/format.ts`,
all `app/components/*.tsx`, all 4 pages, `app/layout.tsx`, plus `docs/ux-design.md` §3 wireframes.

---

## Bugs found & fixed (7)

### 1. Notes ordering mismatch — MEDIUM
- **File:** `lib/db.ts:250`
- **What was wrong:** `getProduct()` returned notes `ORDER BY created_at ASC` (oldest first),
  but the detail page's `handleAddNote` prepends new notes (`[note, ...product.notes]`).
  A note appeared at the top when added, then jumped to the bottom after refresh.
  The wireframe shows newest-first.
- **Fix:** backend now returns `ORDER BY created_at DESC, id DESC`, matching the frontend.

### 2. Analytics "Avg price by tag" hardcoded USD — MEDIUM
- **Files:** `lib/db.ts:86-88`, `lib/db.ts` `getAnalytics()` query + mapper, `app/lib/types.ts:55`, `app/analytics/page.tsx:142,148`
- **What was wrong:** `avgPriceByTag` rows carried no currency; the page formatted every
  average as USD (`formatPrice(avgPrice, 'USD')`) even for GBP/EUR products — wrong labels
  when the watchlist mixes marketplaces.
- **Fix:** `getAnalytics()` now returns the most common currency among each tag's priced
  products (correlated subquery); `AvgPriceByTag` gained `currency: string | null`;
  the page renders `formatPrice(avgPrice, currency)`. Approximation is documented in a
  code comment (averaging mixed currencies is inherently approximate).

### 3. Orphan tags inflated the "Tags used" KPI — LOW-MEDIUM
- **File:** `lib/db.ts:326,345,356`
- **What was wrong:** `setProductTags` (wholesale replace) and `deleteProduct` removed tag
  *links* but never tag *rows*, so `totals.tags` counted tags with zero products.
  Confirmed on the real dev DB: 3 tags present, 0 linked.
- **Fix:** new `pruneOrphanTags()` runs inside both write paths
  (`DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM product_tags ...)`).
  Also cleaned the 3 pre-existing orphans from `data/dashboard.db`.

### 4. Analyze double-submit race — LOW
- **File:** `app/page.tsx:51,54,61,77`
- **What was wrong:** two rapid Enters (or double-click) could fire two `/api/analyze`
  requests before the re-render disabled the button — wasted scrape + confusing state.
- **Fix:** `busyRef` guard (ref, not state, so it works between renders); early return if busy.

### 5. Watchlist tag chips went stale after delete — LOW
- **File:** `app/watchlist/page.tsx:88`
- **What was wrong:** the chip universe (`allTags`) was fetched once on mount; deleting a
  product left its unique tags as filter chips that matched zero products.
- **Fix:** on successful delete, recompute the chip set from the remaining products.

### 6. Tag add/remove race on detail page — LOW
- **File:** `app/products/[id]/page.tsx:36,63,77,318,344,347`
- **What was wrong:** `persistTags` reads `product.tags` from a closure; two rapid
  add/removes (or add-then-remove) could base the wholesale PATCH on stale state and
  silently drop a tag.
- **Fix:** `tagsBusy` state serializes PATCHes; Add and tag-remove buttons disable while busy.

### 7. Nav didn't highlight on product detail pages — LOW (UX)
- **File:** `app/components/Nav.tsx:24`
- **What was wrong:** on `/products/[id]` no nav item was active (the `/` link requires
  exact match; `/watchlist` didn't match).
- **Fix:** `/products/*` now highlights "Watchlist".

---

## Parent follow-up items — verified

- **Rating-bucket labels (hyphen vs en-dash):** CLEARED, no fix needed. The backend returns
  all four buckets with ASCII-hyphen labels (`<3.0`, `3.0-4.0`, `4.0-4.5`, `4.5+`) and the
  analytics page renders `bucket` verbatim — it never string-matches labels, so rows render
  correctly as-is.
- **Orphan tags in watchlist filter chips:** CLEARED, no frontend fix needed. Chips are
  derived from the *products'* tag arrays (`listProducts()`), not the global `tags` table,
  so orphan tags could never appear as chips. (Backend now prunes them anyway — fix #3.)

---

## Checked and cleared (no bug)

- **XSS via `href`/`src`:** backend enforces `http(s)` on `url` (create) and `imageUrl`;
  analyze requires `http(s)`; all text rendered via React escaping. `javascript:` URLs
  cannot reach the DOM.
- **Duplicate save:** unique URL → 409 → frontend toasts "already saved". ✓
- **Error paths:** `readJson` → 400 on bad JSON everywhere; analyze 400/502; 404s on
  missing product/note; note ID validated as positive int; PATCH requires a tags array.
- **Search:** LIKE wildcards escaped (`escapeLike`). Tag filter lowercased server-side.
- **Contract shapes:** PATCH returns `{product}` with tags array; note IDs numeric;
  `createdAt` ISO strings; `formatDate(Time)` guards invalid dates; monthly-sales row
  hidden when null (never "0").
- **Tailwind:** `!h-32 !w-full` on `Thumb` is valid v3 important-prefix syntax (project
  uses tailwindcss 3.4.13) and beats the inline style. Fragile but working — left alone.
- **Components:** Toast capped at 3 with `aria-live`; skeletons have `aria-label`;
  `Stars` fractional overlay + accessible label; `MarketplaceBadge` falls back to
  "Web" for unknown values; `ConfirmInline` no-modals per design.
- **Intentional deviations:** home page pre-check blocks non-Etsy/Amazon URLs while the
  backend accepts `other` (per wireframe: Etsy/Amazon only); sample URLs only fill the
  input; analytics "Most-noted products" replaces the wireframe's "Recent notes" panel
  (documented in the page header — avoids N+1 note fetches).
- **Dead code (harmless):** `ratingBuckets.length === 0` branch in analytics can never
  trigger (backend always returns 4 buckets); `notesCount` destructure-strip in
  `getProduct` works as intended.

---

## Verification performed

- `npx tsc --noEmit` — **clean, exit 0** (after all fixes).
- SQL sanity on a temp copy of the real DB: currency subquery executes, orphan-prune
  statement executes, notes `DESC` ordering executes. (Note: copying only `dashboard.db`
  without its `-wal` file yields an empty shell — WAL mode keeps live data in the WAL.)
- Real `data/dashboard.db`: pruned 3 pre-existing orphan tags (0 linked); app starts clean.

## Could NOT verify

- Live end-to-end behavior in a real browser (no live-browser access in this workstream);
  race-condition fixes are reasoned from code, not click-tested.
- Real Etsy/Amazon fetch behavior — the scraper workstream already documented its
  limitations (Amazon blocks plain fetches; manual entry is the intended path).

---

## V2 proposals (concrete)

1. **CSV export** — one-click download of the watchlist
   (url, title, price, currency, rating, review count, est. sales, tags, notes count).
   Natural complement to the planned bulk import; trivial to build on `listProducts()`.
2. **Price-drop alerts** — scheduled re-analyze (cron/worker) storing a price-history
   table per product; toast/email when a watched product's price moves more than X%.
   Requires the history table the wireframe deliberately deferred.
3. **Bulk import** — paste N URLs, queued analysis with per-URL progress and a summary
   of successes/failures. Needs concurrency limits to stay respectful (1 req / few sec).
4. **Real charts + price history** — replace CSS bars with a chart lib and plot per-product
   price/rating over time from the history table in (2).
5. **Auth + shared workspaces** — currently a single local user; add login and per-user
   data scoping before any hosted deployment with real users.

Smaller follow-ups: URL canonicalization (strip tracking params) so duplicates like
`?ref=` variants map to one product; split avg-price-by-tag per currency instead of
most-common; keyword search-volume enrichment via a real API.
