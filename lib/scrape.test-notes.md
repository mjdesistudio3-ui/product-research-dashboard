# scrape.ts — Test Notes

Manual verification guide for `analyzeProductUrl`. Run these with `node`
(after compiling) or a quick Next.js route handler; compare against the
expectations below.

## Example URLs & expected JSON-LD yields

### 1. Etsy listing (example format)
`https://www.etsy.com/listing/123456789/personalized-leather-journal-gift`
- **marketplace:** `etsy`
- **title:** full listing title, e.g. `"Personalized Leather Journal for Men, Gift for Dad"`
- **price / currency:** offer price + `priceCurrency: "USD"`
- **rating / reviewCount:** from `aggregateRating` — note: Etsy historically
  does not expose aggregateRating on every listing; expect `null`s here for
  some items.
- **imageUrl:** first image URL string.
- **keywords:** from title, e.g. `["personalized","leather","journal","gift","dad","men"]`
- **monthlySalesEstimate:** `reviewCount * 25` only if reviewCount present;
  else `null`.

### 2. Etsy shop listing, another niche
`https://www.etsy.com/listing/987654321/cozy-fall-candle-set-soy`
- Same expectations as above; JSON-LD `Product` entity is usually present on
  Etsy listing pages and yields name/offers/image reliably.

### 3. Amazon product page (example format)
`https://www.amazon.com/dp/B0EXAMPLE12`
- **marketplace:** `amazon`
- **Expected result in most real environments:** `error: 'fetch blocked'`
  (HTTP 403/503) — Amazon's bot mitigation rejects plain `fetch` requests
  even with a browser User-Agent, and/or serves a CAPTCHA with no JSON-LD.
  The module handles this gracefully: nulls + `error` set, so the UI offers
  manual entry. A regional domain like `amazon.co.uk` maps to `amazon` too.

### 4. Non-marketplace page with JSON-LD (fallback path)
`https://www.example.com/shop/blue-widget` (hypothetical page with a
schema.org `Product` JSON-LD block)
- **marketplace:** `other`
- Still parsed for name/offers/aggregateRating — the module does not
  hard-code to Etsy/Amazon.

## Known limitations

1. **Amazon usually blocks non-browser fetches.** Expect `error: 'fetch blocked'`
   or `'no structured data found'` for amazon.* URLs; the UI's manual-entry
   fallback is the intended path there. A production fix would use an
   approved source (e.g. Amazon PA-API) rather than scraping.
2. **No JS rendering.** JSON-LD is parsed from the raw HTML of a single
   request; pages that inject structured data client-side yield nothing.
3. **Robots.txt is honored per-path.** If a host disallows the product path
   for `User-agent: *`, the module returns `error: 'blocked by robots.txt'`
   without ever requesting the page.
4. **Heuristic sales estimate.** `reviewCount * 25` is a back-of-the-envelope
   proxy, clearly labeled in `estimateNote`. It is NOT verified sales data
   and must never be presented as such.
5. **Summary stats only.** The module reads name, offers, rating, review
   count, and image from JSON-LD. It never extracts descriptions, review
   text, or full page content.
6. **Rate behavior.** One HTTP request per analysis (plus the robots.txt
   check), 10s page timeout / 5s robots timeout, no retries, no concurrency —
   designed to be polite, not to hammer hosts.
