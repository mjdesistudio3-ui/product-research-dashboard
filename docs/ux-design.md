# UX & Product Design — Product Research Dashboard (V1)

**Date:** 2026-10-07 · **Audience:** solo e-commerce seller (Makmud), desktop-first web app
**Stack:** Next.js 14 App Router + TypeScript + Tailwind · better-sqlite3 via API routes · no auth in V1

---

## 1. User Stories

1. **As a seller, I want to paste an Etsy/Amazon product URL and get an instant snapshot** (price, rating, review count, estimated monthly sales, top keywords) **so that** I can judge a product's potential in under 30 seconds without opening ten tabs.
2. **As a seller, I want to save an analyzed product to my watchlist with one click so that** I don't lose promising leads while I'm in research flow.
3. **As a seller, I want to tag saved products** (e.g. "magnets", "home", "gift") **so that** I can group ideas by niche and compare like-with-like later.
4. **As a seller, I want to write free-text notes on a product so that** I capture my reasoning ("high reviews but thin margins — revisit in Q4") next to the data.
5. **As a seller, I want to filter and search my watchlist by tag or keyword so that** I can quickly narrow down to the niche I'm currently evaluating.
6. **As a seller, I want an analytics view showing average price by tag and rating distribution so that** I can spot pricing patterns and quality benchmarks per niche at a glance.
7. **As a seller, I want to delete products (or remove tags/notes) so that** my watchlist stays a curated shortlist, not a junk drawer.

---

## 2. V1 Scope

### IN (ship these)
- URL input on home page with marketplace auto-detect (Etsy / Amazon / unsupported-url validation).
- Analyze action: `POST /api/analyze {url}` returns snapshot JSON — **not persisted** until the user explicitly saves.
- Snapshot card: title, image thumbnail, price + currency, rating (stars + count), estimated monthly sales (if inferable), top keywords (chips).
- "Save to watchlist" button on the snapshot card; optional tag input at save time (comma-separated, new tags created on the fly).
- Watchlist page: list of saved products (thumbnail, title, price, rating, tags), text search (`?q=`), tag filter (`?tag=`), delete action per product.
- Product detail page `/products/[id]`: full snapshot, tag editor (add/remove), notes list with add/delete, "re-analyze" is NOT in V1 — delete + re-add instead.
- Analytics page: average price grouped by tag (bar list/table), rating distribution buckets (e.g. <3, 3–4, 4–4.5, 4.5+), totals (product count, tag count, note count).
- All API endpoints from the data contract, with input validation + sensible error JSON (`{ error: string }` + HTTP status).
- Basic states everywhere: empty, loading, error.

### OUT (defer to V2)
- Auth / multi-user — single local user, no login.
- Price-history tracking / scheduled re-scraping / alerts.
- Charts (recharts etc.) — V1 analytics are tables + simple CSS bars, not chart libraries.
- Bulk import (CSV/paste-multiple), CSV export, pagination beyond simple limits.
- Real competitor keyword research (search-volume data) — keywords are extracted from the product page only.
- Edit of snapshot fields by hand (title/price/rating) — data is read-only from analysis; delete + re-save is the workaround.
- Mobile-specific layouts — desktop-first; pages should degrade gracefully but aren't optimized for phones.
- Image upload or custom thumbnails.

---

## 3. Text Wireframes

Notation: `[ ]` = input, `( )` = button, `>` = link/nav. Each screen lists layout top→bottom plus the three states.

### Screen A — Home `/` (URL input → analyze → snapshot card)

**Layout:**
```
┌ Header: logo "ResearchDash" | nav: Analyze | Watchlist | Product | Analytics (right: none)
├ Hero block (max-w-2xl, centered):
│   H1: "Research a product"
│   Sub: "Paste an Etsy or Amazon product URL. Get price, ratings, sales estimate, keywords."
│   [ URL input, placeholder "https://www.etsy.com/listing/… or amazon.com/dp/…" ] ( Analyze )
│   helper text: "We read public summary data only. Nothing is saved until you click Save."
├ (empty state — default) 3 sample URL chips: "Try: Etsy mug · Amazon LED strip · Etsy tote" → clicking fills the input
├ (loading state) skeleton card: gray pulsing blocks for image/title/price rows; button disabled, spinner in ( Analyze )
├ (error state) red-tinted banner under input: e.g. "That URL doesn't look like an Etsy or Amazon product page." / "Couldn't fetch this product (site blocked us). Try another."
└ (success state) Snapshot card:
    ┌──────────────────────────────────────────────┐
    │ [thumb 96px]  Title (2-line clamp)            │
    │             Marketplace badge · analyzed "just now" │
    │             $24.99 USD   ★4.6 (1,284 reviews) │
    │             Est. monthly sales: ~340 (estimate)|
    │             Keywords: [ceramic mug][funny gift][…] │
    │  [ tag input: "Add tags, comma separated…" ] │
    │  ( Save to watchlist )   > View on marketplace ↗ │
    └──────────────────────────────────────────────┘
    After save: green toast "Saved ✓" + button becomes ( Saved — View in watchlist > )
```

**Key behaviors:** Enter submits. Marketplace badge color-coded (Etsy orange / Amazon blue-gray). Est. sales row hidden entirely if `monthly_sales_est` is null — never show "0". Keyword chips are display-only (no click action in V1).

### Screen B — Watchlist `/watchlist`

**Layout:**
```
┌ Header (same)
├ Page head: H1 "Watchlist" + count "(12)" + ( + Research new ) button → links to /
├ Toolbar row: [ Search products… ]   Tag filter chips: (All)(magnets)(home)(gift)… [+N more]
├ (empty state) centered illustration-free panel:
│   "No products yet." / "Analyze a URL to start building your shortlist." / ( Analyze a product )
│   (empty-after-filter state): "No products match 'mug' + tag 'home'." / ( Clear filters )
├ (loading) 4 skeleton rows
├ (error) banner: "Couldn't load your watchlist." ( Retry )
└ Product rows (grid of cards, 3-col desktop):
    ┌────────────────────┐
    │ [thumb]            │
    │ Title (2-line)     │
    │ $24.99 · ★4.6(1.2k)│
    │ tags: [magnets][gift] │
    │ (⋯ delete)  > Details │
    └────────────────────┘
    Cards sorted newest-first. Clicking card body (not buttons) → /products/[id].
    Delete = small trash icon, confirm via inline confirm ("Delete? ( Yes / No )") — no modal in V1.
```

**Key behaviors:** Search debounced 300ms hits `GET /api/products?q=`. Tag chips toggle single-select (`?tag=`); "All" clears. Deleting updates list optimistically; toast "Removed".

### Screen C — Product detail `/products/[id]`

**Layout:**
```
┌ Header (same)
├ Breadcrumb: < Back to watchlist
├ Two-column (2fr 1fr), desktop:
│  LEFT:
│   ┌ Snapshot panel ──────────────────┐
│   │ [thumb 160px] Title              │
│   │ marketplace badge · added Oct 7  │
│   │ $24.99 USD  ★4.6 (1,284 reviews) │
│   │ Est. monthly sales: ~340         │
│   │ Keywords: [chips]                │
│   │ > View original listing ↗        │
│   └──────────────────────────────────┘
│   ┌ Notes ───────────────────────────┐
│   │ [ textarea "Add a note…" ] ( Add note )
│   │ • "Thin margins at this price…" — Oct 7, 22:41   (delete ×)
│   │ • "Seller runs 20% off monthly…" — Oct 6          (delete ×)
│   │ (empty notes): "No notes yet. Jot down why this made your shortlist."
│   └──────────────────────────────────┘
│  RIGHT sidebar:
│   ┌ Tags ────────────────┐
│   │ [existing chips ×]   │
│   │ [ input + ( Add ) ]  │
│   └──────────────────────┘
│   ┌ Danger zone ─────────┐
│   │ ( Delete product )   │
│   └──────────────────────┘
├ (loading): skeleton of both columns
├ (error / 404): "Product not found. It may have been deleted." ( Back to watchlist )
└ URL shown as plain text under title (not auto-linked except the ↗ button).
```

**Key behaviors:** Tags add/remove via `PATCH /api/products/[id]` (tags replaced wholesale from client) — client keeps local list, sends full array. Notes via `POST /api/products/[id]/notes`, delete via `DELETE /api/notes/[id]` with inline confirm. Delete product → redirect to `/watchlist` with toast.

### Screen D — Analytics `/analytics`

**Layout:**
```
┌ Header (same)
├ H1 "Analytics" + sub "Based on N saved products · updated live"
├ KPI strip (4 stat cards): Products tracked | Tags used | Notes written | Avg rating (all products)
├ ┌ Avg price by tag ──────────────────────────┐
│ │ tag        avg price   n                    │
│ │ [magnets]  $18.40     5   ████████░░       │
│ │ [home]     $32.10     3   ██████████████   │
│ │ (CSS bars, max bar = highest avg; hide tags with 0 products — can't happen by construction)
│ │ (empty): "Save products with tags to see price benchmarks per niche."
│ └────────────────────────────────────────────┘
├ ┌ Rating distribution ───────────────────────┐
│ │ ★ <3.0      1   ██                         │
│ │ ★ 3.0–4.0   2   ████                       │
│ │ ★ 4.0–4.5   6   ████████████               │
│ │ ★ 4.5+      3   ██████                     │
│ │ (counts from GET /api/analytics ratingBuckets)
│ └────────────────────────────────────────────┘
├ ┌ Recent notes ──────────────────────────────┐
│ │ "Thin margins…" — on Ceramic Mug (Oct 7) >│
│ │ (latest 5 notes across products, each links to its product page)
│ └────────────────────────────────────────────┘
└ (empty-everything state): single panel "Nothing to analyze yet." ( Analyze a product )
```

**Key behaviors:** Data from one `GET /api/analytics` call. No interactivity beyond note links in V1 (no tag click-through — V2). Bars are pure CSS widths.

---

## 4. Information Architecture & Navigation

**Global nav (header, all pages):** `Analyze` (`/`) · `Watchlist` (`/watchlist`) · `Analytics` (`/analytics`). Active route highlighted (underline/bold). No logo-dropdown, no user menu (no auth).

**URL map:**

| Route | Purpose | Data |
|---|---|---|
| `/` | Analyze URL → snapshot → save | `POST /api/analyze` (ephemeral), `POST /api/products` (save) |
| `/watchlist` | Saved products, search + tag filter | `GET /api/products?tag=&q=` |
| `/products/[id]` | Detail: snapshot, tags, notes | `GET /api/products/[id]`, `PATCH`, `DELETE`, notes endpoints |
| `/analytics` | Avg price by tag, rating buckets, notes | `GET /api/analytics` |

**Navigation flows:**
- `/` → (Save) → toast offers `> View in watchlist`; also navigable via header.
- `/watchlist` → card click → `/products/[id]` → delete → back to `/watchlist`.
- `/analytics` → note row click → `/products/[id]`.
- `/watchlist` → `( + Research new )` → `/`.

**State/URL conventions:** watchlist filters live in the query string (`?tag=magnets&q=mug`) so a filtered view is shareable/bookmarkable. `id` is an opaque string (UUID or slug from backend). No nested routes beyond `/products/[id]`.

---

## 5. Key UX Decisions & Tradeoffs

**Analyze-before-save keeps research flow fast and the DB clean.** The snapshot is ephemeral: `POST /api/analyze` returns JSON and persists nothing. This avoids junk rows from mistyped URLs or curiosity clicks, and it means the scraper module never needs write permissions. The tradeoff is that an analyzed-but-unsaved product disappears on refresh — acceptable for V1, since the whole point of the snapshot card is the one-click save.

**Tags are free-text and created on the fly.** There's no tag-management screen; typing "magnets, home" at save time (or on the detail page) creates missing tags via the `tags` table's UNIQUE name. This matches how a solo seller actually works — taxonomies emerge — and keeps the UI to a single input. The risk is tag sprawl ("gift" vs "gifts"); V2 can add rename/merge, but V1 favors speed over taxonomy hygiene.

**Analytics are read-only CSS bars, not a chart library.** Average price by tag and rating buckets are simple enough for styled divs; pulling in recharts adds bundle weight and build risk for zero analytical gain at this data scale. The analytics page is also deliberately non-interactive (no drill-down) — its job is a 10-second gut check, and drill-down duplicates what the watchlist filters already do.

**Destructive actions use inline confirm, not modals.** Delete product / delete note / remove tag all confirm in place ("Delete? Yes / No"). A solo-user local tool doesn't need modal dialogs, focus traps, or undo stacks; inline confirm is faster to build, impossible to get stuck behind, and honest about irreversibility. If accidental deletes become a real complaint, V2 adds soft-delete or undo toasts rather than heavier dialogs.

**Desktop-first with graceful degradation, not responsive design.** The seller does research at a desk with many tabs open; optimizing for phone layouts would double the CSS work for a use case that doesn't exist yet. Grids collapse to single column below ~768px via Tailwind's responsive prefixes as a freebie, but no mobile-specific interactions are designed or QA'd in V1.
