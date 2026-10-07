/**
 * Shared frontend types. These mirror the backend's JSON shapes
 * (see the API contract in the workstream brief). All snapshot fields
 * are nullable — the scraper returns nulls when data is unavailable.
 */

export type Marketplace = 'etsy' | 'amazon' | 'other';

export interface ProductSnapshot {
  url: string;
  marketplace: Marketplace;
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

export interface ProductSummary {
  id: string;
  url: string;
  marketplace: Marketplace;
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

export interface Note {
  id: number;
  body: string;
  createdAt: string;
}

export interface ProductDetail extends Omit<ProductSummary, 'notesCount'> {
  notes: Note[];
}

export interface AvgPriceByTag {
  tag: string;
  avgPrice: number;
  count: number;
  currency: string | null;
}

export interface RatingBucket {
  bucket: string;
  count: number;
}

export interface AnalyticsData {
  avgPriceByTag: AvgPriceByTag[];
  ratingBuckets: RatingBucket[];
  totals: {
    products: number;
    tags: number;
    notes: number;
    avgRating: number | null;
  };
}
