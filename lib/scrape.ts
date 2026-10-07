/**
 * scrape.ts — Safe, respectful product-data extraction for the Product Research Dashboard.
 *
 * Strategy:
 *   1. Validate the URL (http/https only).
 *   2. Check the host's robots.txt (5s timeout). If the product path is
 *      disallowed, bail out without fetching the page.
 *   3. Fetch the product page exactly once (10s timeout, desktop User-Agent).
 *   4. Parse schema.org JSON-LD <script> blocks for a Product entity and pull
 *      summary stats (name, price, rating, review count, image).
 *   5. Derive keywords from the title only — never scrape full descriptions
 *      or review text.
 *   6. monthlySalesEstimate = reviewCount * 25, ONLY when a review count exists.
 *
 * Never throws: every failure path returns a ProductSnapshot with `error` set
 * and nulls elsewhere, so the UI can offer manual entry.
 */

export interface ProductSnapshot {
  url: string;
  marketplace: 'etsy' | 'amazon' | 'other';
  title: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  reviewCount: number | null;
  keywords: string[];
  imageUrl: string | null;
  monthlySalesEstimate: number | null;
  estimateNote: string | null;
  error: string | null;
}

const SALES_MULTIPLIER = 25;
const ESTIMATE_NOTE = 'Rough heuristic from review count — not verified sales data.';

// A single desktop Chrome UA — one polite request, no browser impersonation circus.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Stopwords for keyword extraction. Covers common English + a few marketplace tokens.
const STOPWORDS = new Set([
  'a','an','the','and','or','of','for','to','in','on','with','at','by','from',
  'is','are','it','its','this','that','these','those','as','be','has','have',
  'was','were','will','new','best','top','set','pack','kit','gift','sale',
  'handmade','custom','personalized','unique','free','shipping','made','your',
]);

// Minimal robots.txt parser: honors User-agent: * / disallowed-path blocks only.
// We fetch the file first, so anything we read here is data, never instructions.
function isDisallowedByRobots(robotsText: string, path: string): boolean {
  const lines = robotsText.split('\n');
  let inWildcardBlock = false;
  for (const raw of lines) {
    const line = raw.trim().toLowerCase();
    if (line.startsWith('user-agent:')) {
      // Only honor the wildcard block (and any block matching our bot UA);
      // per-host specific agents for other crawlers don't apply to us.
      inWildcardBlock = line.includes('*') || line.includes('muse');
    } else if (line.startsWith('disallow:')) {
      const rule = line.slice('disallow:'.length).trim();
      if (inWildcardBlock && rule && rule !== '/') {
        // Non-obvious: a Disallow of exactly '/' means "block everything",
        // which we treat as blocked regardless (handled via prefix match).
        if (path === rule || path.startsWith(rule.endsWith('/') ? rule : rule + '/')) {
          return true;
        }
      } else if (inWildcardBlock && rule === '/') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract schema.org JSON-LD <script> blocks from raw HTML without a DOM parser.
 * A regex scan for <script type="application/ld+json"> is enough for summary
 * extraction and keeps this module dependency-free.
 */
function extractJsonLdProducts(html: string): any[] {
  const products: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        collectProducts(node, products);
      }
    } catch {
      // Invalid JSON-LD block — skip it; other blocks may still parse.
    }
  }
  return products;
}

/** Recursively walk a JSON-LD graph collecting entities with @type Product. */
function collectProducts(node: any, out: any[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectProducts(n, out));
    return;
  }
  const type = node['@type'];
  const isProduct =
    type === 'Product' || (Array.isArray(type) && type.includes('Product'));
  if (isProduct) out.push(node);
  // @graph arrays nest entities one level deep; also walk plain nested objects.
  if (Array.isArray(node['@graph'])) collectProducts(node['@graph'], out);
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value !== node['@graph']) {
      collectProducts(value, out);
    }
  }
}

/** Pick the first usable offers object from a Product's `offers` field. */
function pickOffer(product: any): any | null {
  const offers = product.offers;
  if (!offers) return null;
  const list = Array.isArray(offers) ? offers : [offers];
  for (const offer of list) {
    if (offer && typeof offer === 'object' && offer.price != null) return offer;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Derive top keywords from the title: lowercase, stopword-filtered, max 8. */
function keywordsFromTitle(title: string | null): string[] {
  if (!title) return [];
  const counts = new Map<string, number>();
  for (const word of title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([w]) => w);
}

function detectMarketplace(hostname: string): ProductSnapshot['marketplace'] {
  const host = hostname.toLowerCase();
  if (host === 'etsy.com' || host.endsWith('.etsy.com')) return 'etsy';
  // Amazon has regional TLDs (amazon.co.uk, amazon.de, …) — match the brand root.
  if (host === 'amazon.com' || host.endsWith('.amazon.com') || /(^|\.)amazon\.[a-z.]+$/.test(host)) {
    return 'amazon';
  }
  return 'other';
}

/** Failure helper: returns a snapshot with `error` set, nulls elsewhere. */
function failure(url: string, marketplace: ProductSnapshot['marketplace'], error: string): ProductSnapshot {
  return {
    url,
    marketplace,
    title: null,
    price: null,
    currency: null,
    rating: null,
    reviewCount: null,
    keywords: [],
    imageUrl: null,
    monthlySalesEstimate: null,
    estimateNote: null,
    error,
  };
}

export async function analyzeProductUrl(url: string): Promise<ProductSnapshot> {
  // --- 1. Validate input ---------------------------------------------------
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return failure(url, 'other', 'invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return failure(url, 'other', 'only http(s) URLs are supported');
  }
  const marketplace = detectMarketplace(parsed.hostname);
  const path = parsed.pathname + parsed.search;

  // --- 2. Respect robots.txt ----------------------------------------------
  try {
    const robotsRes = await fetch(`${parsed.origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (robotsRes.ok) {
      const robotsText = await robotsRes.text();
      if (isDisallowedByRobots(robotsText, path)) {
        return failure(url, marketplace, 'blocked by robots.txt');
      }
    }
    // Non-OK robots.txt fetch: treat as "no restrictions stated" and continue.
  } catch {
    return failure(url, marketplace, 'fetch blocked');
  }

  // --- 3. Fetch the page once ----------------------------------------------
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        // Some hosts serve JSON-LD only to requests that look like a browser.
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
      // No retries, no redirects beyond what fetch does by default.
    });
    if (!res.ok) {
      // 403/503 from Amazon & friends is usually bot mitigation/CAPTCHA.
      if (res.status === 403 || res.status === 503) {
        return failure(url, marketplace, 'fetch blocked');
      }
      return failure(url, marketplace, `page returned HTTP ${res.status}`);
    }
    html = await res.text();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return failure(url, marketplace, 'fetch timed out');
    }
    return failure(url, marketplace, 'fetch blocked');
  }

  // --- 4. Parse JSON-LD ------------------------------------------------------
  const products = extractJsonLdProducts(html);
  if (products.length === 0) {
    // Common on Amazon: bot wall or JS-rendered pages carry no JSON-LD.
    return failure(url, marketplace, 'no structured data found');
  }

  // Prefer the first Product that actually carries an offer (price).
  const product = products.find((p) => pickOffer(p)) ?? products[0];
  const offer = pickOffer(product);

  const title: string | null =
    typeof product.name === 'string' && product.name.trim() ? product.name.trim() : null;

  const price = offer ? toNumber(offer.price) : null;
  const currency: string | null =
    offer && typeof offer.priceCurrency === 'string' ? offer.priceCurrency.toUpperCase() : null;

  const agg = product.aggregateRating;
  const rating = agg ? toNumber(agg.ratingValue) : null;
  const reviewCount = agg ? toNumber(agg.reviewCount) : null;

  const image = product.image;
  const imageUrl: string | null =
    typeof image === 'string'
      ? image
      : Array.isArray(image) && typeof image[0] === 'string'
        ? image[0]
        : null;

  // --- 5. Keywords from title only -------------------------------------------
  const keywords = keywordsFromTitle(title);

  // --- 6. Sales heuristic ------------------------------------------------------
  const monthlySalesEstimate =
    reviewCount != null ? Math.round(reviewCount * SALES_MULTIPLIER) : null;
  const estimateNote = reviewCount != null ? ESTIMATE_NOTE : null;

  return {
    url,
    marketplace,
    title,
    price,
    currency,
    rating,
    reviewCount,
    keywords,
    imageUrl,
    monthlySalesEstimate,
    estimateNote,
    error: null,
  };
}
