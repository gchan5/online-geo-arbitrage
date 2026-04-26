// Mercari listing data extracted from __NEXT_DATA__
export interface MercariListing {
  title_jp: string
  images: string[]          // thumbnail URLs from Mercari CDN
  price_jpy: number
  condition: string         // raw JP condition string
  condition_en: string      // mapped English condition
  seller_rating: string     // e.g. "4.8 (312)"
  shipping_included: boolean
  url: string               // original Mercari JP listing URL
}

export interface MercariError {
  error: string
  step: 'mercari'
}

// eBay listing normalized from Browse API
export interface EbayListing {
  title: string
  price_usd: number
  sold_date: string         // ISO date string
  condition: string
  url: string               // viewItemURL
  thumbnail: string         // galleryURL
}

// Fee calculation inputs — all editable fields have defaults
export interface FeeInputs {
  mercariPriceJpy: number
  usdRate: number
  buyeeServiceFeeJpy: number        // default: 300
  buyeeDomesticShipJpy: number      // default: 500
  intlShippingUsd: number           // default: 10.00
  ebayDomesticShipUsd: number       // default: 4.50
  ebayFvfPct: number                // default: 13.25
  ebayPerOrderFee: number           // default: 0.30
}

export interface FeeResult {
  totalCostUsd: number
  totalCostFreeShip: number
  totalCostBuyerShip: number
  ebayDeductionFreeShip: number
  ebayDeductionBuyerShip: number
  netRevenueFreeShip: number
  netRevenueBuyerShip: number
  profitFreeShip: number
  profitBuyerShip: number
  avgSalePrice: number
  medianSalePrice: number
  highSalePrice: number
  lowSalePrice: number
  breakEvenFreeShip: number
}

// NDJSON stream chunks from /api/analyze
export type AnalyzeChunk =
  | { type: 'mercari'; data: MercariListing }
  | { type: 'meta'; data: { title_en: string; usd_rate: number } }
  | { type: 'ebay'; data: { listings: EbayListing[]; total_results: number } }
  | { type: 'error'; message: string; step: 'mercari' | 'translate' | 'ebay' }
