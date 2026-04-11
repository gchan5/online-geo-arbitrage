# Mercari JP → eBay Arbitrage Compare App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-mode Next.js web app hosted on Vercel where you paste a Mercari JP listing URL and see matching eBay sold listings plus a full fee-aware arbitrage profit estimate.

**Architecture:** A single Next.js 14 App Router project with two streaming API routes: `/api/analyze` (scrape Mercari → translate → search eBay, returning NDJSON chunks) and `/api/ebay-search` (re-search eBay by title only). The client reads the stream progressively and populates a two-column layout with an arbitrage dashboard at the bottom.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, cheerio, eBay Finding API, Google Cloud Translation API v2, Frankfurter.app (exchange rates), Vitest (tests), Vercel (hosting)

---

## File Map

| File | Responsibility |
|---|---|
| `app/page.tsx` | Root client component — owns all state, reads stream, renders panels |
| `app/globals.css` | Tailwind base, dark mode defaults |
| `app/api/analyze/route.ts` | Streaming POST: Mercari → translate → eBay, sends NDJSON chunks |
| `app/api/ebay-search/route.ts` | Lightweight POST: `{ query }` → `{ listings }` for re-search |
| `lib/mercari.ts` | `fetchMercariListing(url)` — fetch + parse `__NEXT_DATA__` JSON |
| `lib/ebay.ts` | `findSoldListings(query)` — eBay Finding API `findCompletedItems` |
| `lib/translate.ts` | `translateToEnglish(text)` — Google Translate REST v2 |
| `lib/exchange-rate.ts` | `fetchExchangeRate()` — Frankfurter JPY→USD with fallback |
| `lib/fees.ts` | `calculateFees(inputs, salePrices)` — pure fee arithmetic |
| `lib/types.ts` | Shared TypeScript interfaces used across lib + components |
| `components/UrlInput.tsx` | URL bar + Compare button |
| `components/MercariPanel.tsx` | Left panel: big image, JP/EN title, price, details |
| `components/EbayPanel.tsx` | Right panel: sold listing rows with thumbnails + links |
| `components/ArbitrageBar.tsx` | Bottom dashboard: profit, fee breakdown, ship toggle |
| `next.config.ts` | Remote image domains (Mercari CDN, eBay CDN) |
| `vitest.config.ts` | Vitest configuration |
| `tests/fees.test.ts` | Unit tests for fee calculation |
| `tests/mercari.test.ts` | Unit tests for Mercari parser |
| `tests/ebay.test.ts` | Unit tests for eBay client |
| `tests/exchange-rate.test.ts` | Unit tests for exchange rate fetcher |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `vitest.config.ts`, `tsconfig.json`, `.env.local.example`, `.gitignore`, `app/globals.css`, `app/layout.tsx`

- [ ] **Step 1: Bootstrap Next.js project**

```bash
cd /Users/admin/Projects/compare-app
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-git
```

When prompted, accept defaults. Choose "No" for ESLint if asked (Vitest handles testing).

- [ ] **Step 2: Install additional dependencies**

```bash
npm install cheerio
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to the `"scripts"` block:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Configure next.config.ts for remote images**

Replace the contents of `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.mercdn.net' },
      { protocol: 'https', hostname: '**.mercari.com' },
      { protocol: 'https', hostname: '**.ebaystatic.com' },
      { protocol: 'https', hostname: '**.ebayimg.com' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 6: Create .env.local.example**

```bash
cat > .env.local.example << 'EOF'
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key_here
EBAY_APP_ID=your_ebay_app_id_here
EOF
```

Copy it to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

- [ ] **Step 7: Set dark background in globals.css**

Replace the contents of `app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #09090b;
  --foreground: #f4f4f5;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 8: Update app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mercari Compare',
  description: 'Find eBay arbitrage opportunities from Mercari JP listings',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Add .superpowers/ to .gitignore**

```bash
echo '.superpowers/' >> .gitignore
echo '.env.local' >> .gitignore
```

- [ ] **Step 10: Verify the project runs**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000 with no errors.

- [ ] **Step 11: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js 14 project with Tailwind, Vitest, and image config"
```

---

## Task 2: Shared Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create shared type definitions**

Create `lib/types.ts`:

```typescript
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

// eBay sold listing from Finding API
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared TypeScript types for Mercari, eBay, and fee calculation"
```

---

## Task 3: Fee Calculation (TDD)

**Files:**
- Create: `lib/fees.ts`
- Create: `tests/fees.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/fees.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateFees, DEFAULT_FEE_INPUTS, type FeeInputs } from '@/lib/fees'

const BASE_INPUTS: FeeInputs = {
  mercariPriceJpy: 4000,
  usdRate: 0.00668,
  buyeeServiceFeeJpy: 300,
  buyeeDomesticShipJpy: 500,
  intlShippingUsd: 10.00,
  ebayDomesticShipUsd: 4.50,
  ebayFvfPct: 13.25,
  ebayPerOrderFee: 0.30,
}
// totalCostUsd = (4000 + 300 + 500) * 0.00668 + 10 = 4800 * 0.00668 + 10 = 32.064 + 10 = 42.064 -- wait let me recalc
// (4000 + 300 + 500) = 4800 JPY
// 4800 * 0.00668 = 32.064 USD
// + 10 intl = 42.064 total cost (no eBay domestic)
// + 4.50 = 46.564 total cost free ship

describe('calculateFees', () => {
  it('calculates totalCostUsd correctly', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const expected = (4000 + 300 + 500) * 0.00668 + 10.00
    expect(result.totalCostUsd).toBeCloseTo(expected, 4)
  })

  it('adds ebayDomesticShipUsd to cost for free shipping scenario', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    expect(result.totalCostFreeShip).toBeCloseTo(result.totalCostUsd + 4.50, 4)
  })

  it('does not add domestic shipping to buyer-pays cost', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    expect(result.totalCostBuyerShip).toBeCloseTo(result.totalCostUsd, 4)
  })

  it('calculates eBay deduction for free shipping (FVF on sale price only)', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const expected = 50 * (13.25 / 100) + 0.30
    expect(result.ebayDeductionFreeShip).toBeCloseTo(expected, 4)
  })

  it('calculates eBay deduction for buyer pays (FVF on sale + shipping)', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const expected = (50 + 4.50) * (13.25 / 100) + 0.30
    expect(result.ebayDeductionBuyerShip).toBeCloseTo(expected, 4)
  })

  it('calculates profitFreeShip correctly', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const ebayDeduction = 50 * (13.25 / 100) + 0.30
    const netRevenue = 50 - ebayDeduction
    const totalCostFreeShip = (4000 + 300 + 500) * 0.00668 + 10.00 + 4.50
    expect(result.profitFreeShip).toBeCloseTo(netRevenue - totalCostFreeShip, 4)
  })

  it('calculates profitBuyerShip correctly', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const ebayDeduction = (50 + 4.50) * (13.25 / 100) + 0.30
    const netRevenue = 50 - ebayDeduction
    const totalCostBuyerShip = (4000 + 300 + 500) * 0.00668 + 10.00
    expect(result.profitBuyerShip).toBeCloseTo(netRevenue - totalCostBuyerShip, 4)
  })

  it('calculates stats correctly for multiple prices', () => {
    const result = calculateFees(BASE_INPUTS, [30, 40, 50, 60])
    expect(result.avgSalePrice).toBeCloseTo(45, 4)
    expect(result.medianSalePrice).toBeCloseTo(45, 4)
    expect(result.highSalePrice).toBe(60)
    expect(result.lowSalePrice).toBe(30)
  })

  it('calculates median correctly for odd number of prices', () => {
    const result = calculateFees(BASE_INPUTS, [10, 20, 90])
    expect(result.medianSalePrice).toBe(20)
  })

  it('calculates break-even: profit is ~0 when selling at break-even price', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    // Verify: selling at breakEven should yield ~0 profit (free ship scenario)
    const breakEvenCheck = calculateFees(BASE_INPUTS, [result.breakEvenFreeShip])
    expect(breakEvenCheck.profitFreeShip).toBeCloseTo(0, 1)
  })

  it('DEFAULT_FEE_INPUTS contains expected values', () => {
    expect(DEFAULT_FEE_INPUTS.buyeeServiceFeeJpy).toBe(300)
    expect(DEFAULT_FEE_INPUTS.buyeeDomesticShipJpy).toBe(500)
    expect(DEFAULT_FEE_INPUTS.intlShippingUsd).toBe(10.00)
    expect(DEFAULT_FEE_INPUTS.ebayDomesticShipUsd).toBe(4.50)
    expect(DEFAULT_FEE_INPUTS.ebayFvfPct).toBe(13.25)
    expect(DEFAULT_FEE_INPUTS.ebayPerOrderFee).toBe(0.30)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL with `Cannot find module '@/lib/fees'`

- [ ] **Step 3: Implement lib/fees.ts**

Create `lib/fees.ts`:

```typescript
import type { FeeInputs, FeeResult } from './types'

export type { FeeInputs, FeeResult }

export const DEFAULT_FEE_INPUTS = {
  buyeeServiceFeeJpy: 300,
  buyeeDomesticShipJpy: 500,
  intlShippingUsd: 10.00,
  ebayDomesticShipUsd: 4.50,
  ebayFvfPct: 13.25,
  ebayPerOrderFee: 0.30,
} as const

export function calculateFees(inputs: FeeInputs, salePrices: number[]): FeeResult {
  const {
    mercariPriceJpy, usdRate, buyeeServiceFeeJpy, buyeeDomesticShipJpy,
    intlShippingUsd, ebayDomesticShipUsd, ebayFvfPct, ebayPerOrderFee,
  } = inputs

  const fvf = ebayFvfPct / 100
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  const totalCostUsd =
    (mercariPriceJpy + buyeeServiceFeeJpy + buyeeDomesticShipJpy) * usdRate + intlShippingUsd
  const totalCostFreeShip = totalCostUsd + ebayDomesticShipUsd
  const totalCostBuyerShip = totalCostUsd

  const avgSalePrice = avg(salePrices)
  const sorted = [...salePrices].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const medianSalePrice =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const highSalePrice = Math.max(...salePrices)
  const lowSalePrice = Math.min(...salePrices)

  // Free shipping: FVF charged on sale price only
  const ebayDeductionFreeShip = avgSalePrice * fvf + ebayPerOrderFee
  const netRevenueFreeShip = avgSalePrice - ebayDeductionFreeShip
  const profitFreeShip = netRevenueFreeShip - totalCostFreeShip

  // Buyer pays shipping: eBay charges FVF on sale price + shipping amount
  const ebayDeductionBuyerShip = (avgSalePrice + ebayDomesticShipUsd) * fvf + ebayPerOrderFee
  const netRevenueBuyerShip = avgSalePrice - ebayDeductionBuyerShip
  const profitBuyerShip = netRevenueBuyerShip - totalCostBuyerShip

  // Break-even (free ship): derived from netRevenue - totalCostFreeShip = 0
  // sale * (1 - fvf) - perOrder - totalCostFreeShip = 0
  const breakEvenFreeShip = (totalCostFreeShip + ebayPerOrderFee) / (1 - fvf)

  return {
    totalCostUsd,
    totalCostFreeShip,
    totalCostBuyerShip,
    ebayDeductionFreeShip,
    ebayDeductionBuyerShip,
    netRevenueFreeShip,
    netRevenueBuyerShip,
    profitFreeShip,
    profitBuyerShip,
    avgSalePrice,
    medianSalePrice,
    highSalePrice,
    lowSalePrice,
    breakEvenFreeShip,
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/fees.ts tests/fees.test.ts
git commit -m "feat: add fee calculation with full TDD coverage"
```

---

## Task 4: Exchange Rate (TDD)

**Files:**
- Create: `lib/exchange-rate.ts`
- Create: `tests/exchange-rate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/exchange-rate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchExchangeRate, FALLBACK_RATE } from '@/lib/exchange-rate'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchExchangeRate', () => {
  it('returns JPY to USD rate from Frankfurter API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { USD: 0.00672 } }),
    }))

    const rate = await fetchExchangeRate()
    expect(rate).toBe(0.00672)
  })

  it('calls the correct Frankfurter endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { USD: 0.00672 } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchExchangeRate()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.frankfurter.app/latest?from=JPY&to=USD'
    )
  })

  it('returns FALLBACK_RATE when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const rate = await fetchExchangeRate()
    expect(rate).toBe(FALLBACK_RATE)
  })

  it('returns FALLBACK_RATE when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }))
    const rate = await fetchExchangeRate()
    expect(rate).toBe(FALLBACK_RATE)
  })

  it('FALLBACK_RATE is a reasonable JPY/USD rate', () => {
    expect(FALLBACK_RATE).toBeGreaterThan(0.005)
    expect(FALLBACK_RATE).toBeLessThan(0.015)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL with `Cannot find module '@/lib/exchange-rate'`

- [ ] **Step 3: Implement lib/exchange-rate.ts**

Create `lib/exchange-rate.ts`:

```typescript
export const FALLBACK_RATE = 0.0067  // approximate JPY → USD, used if API is down

export async function fetchExchangeRate(): Promise<number> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=JPY&to=USD')
    if (!res.ok) return FALLBACK_RATE
    const data = await res.json() as { rates: { USD: number } }
    return data.rates.USD
  } catch {
    return FALLBACK_RATE
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/exchange-rate.ts tests/exchange-rate.test.ts
git commit -m "feat: add exchange rate fetcher with fallback"
```

---

## Task 5: Mercari JP Scraper (TDD)

**Files:**
- Create: `lib/mercari.ts`
- Create: `tests/mercari.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/mercari.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMercariListing, mapConditionToEnglish } from '@/lib/mercari'

beforeEach(() => {
  vi.restoreAllMocks()
})

// Minimal __NEXT_DATA__ shape that fetchMercariListing expects
function makeNextData(item: object) {
  return JSON.stringify({
    props: { pageProps: { item } },
  })
}

function makeHtml(nextData: string) {
  return `<html><body>
    <script id="__NEXT_DATA__" type="application/json">${nextData}</script>
  </body></html>`
}

describe('mapConditionToEnglish', () => {
  it('maps known JP condition strings to English', () => {
    expect(mapConditionToEnglish('新品、未使用')).toBe('New, unused')
    expect(mapConditionToEnglish('未使用に近い')).toBe('Like new')
    expect(mapConditionToEnglish('目立った傷や汚れなし')).toBe('No notable scratches or stains')
    expect(mapConditionToEnglish('やや傷や汚れあり')).toBe('Minor scratches or stains')
    expect(mapConditionToEnglish('傷や汚れあり')).toBe('Scratches or stains present')
    expect(mapConditionToEnglish('全体的に状態が悪い')).toBe('Poor overall condition')
  })

  it('returns original string for unknown condition', () => {
    expect(mapConditionToEnglish('unknown')).toBe('unknown')
  })
})

describe('fetchMercariListing', () => {
  it('rejects non-Mercari URLs', async () => {
    const result = await fetchMercariListing('https://example.com/item/m123')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/invalid/i)
    }
  })

  it('returns MercariListing on valid page', async () => {
    const item = {
      id: 'm12345678',
      name: 'ピカチュウex SAR',
      price: 3200,
      itemCondition: '目立った傷や汚れなし',
      thumbnails: ['https://static.mercdn.net/img1.jpg'],
      seller: { ratings: { good: 312, normal: 5, bad: 1 } },
      shippingPayer: 'SELLER',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => makeHtml(makeNextData(item)),
    }))

    const result = await fetchMercariListing('https://jp.mercari.com/item/m12345678')
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.title_jp).toBe('ピカチュウex SAR')
      expect(result.price_jpy).toBe(3200)
      expect(result.condition_en).toBe('No notable scratches or stains')
      expect(result.images).toContain('https://static.mercdn.net/img1.jpg')
      expect(result.shipping_included).toBe(true)
    }
  })

  it('returns error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const result = await fetchMercariListing('https://jp.mercari.com/item/m123')
    expect('error' in result).toBe(true)
  })

  it('returns error when __NEXT_DATA__ is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body>no data here</body></html>',
    }))
    const result = await fetchMercariListing('https://jp.mercari.com/item/m123')
    expect('error' in result).toBe(true)
  })

  it('returns error when response is not ok (e.g. 403)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '',
    }))
    const result = await fetchMercariListing('https://jp.mercari.com/item/m123')
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/blocked|403/i)
    }
  })

  it('formats seller rating from ratings object', async () => {
    const item = {
      id: 'm1', name: 'Test', price: 100,
      itemCondition: '新品、未使用',
      thumbnails: [],
      seller: { ratings: { good: 50, normal: 2, bad: 1 } },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => makeHtml(makeNextData(item)),
    }))
    const result = await fetchMercariListing('https://jp.mercari.com/item/m1')
    if (!('error' in result)) {
      expect(result.seller_rating).toContain('50')
    }
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL with `Cannot find module '@/lib/mercari'`

- [ ] **Step 3: Implement lib/mercari.ts**

Create `lib/mercari.ts`:

```typescript
import * as cheerio from 'cheerio'
import type { MercariListing, MercariError } from './types'

export type { MercariListing, MercariError }

const CONDITION_MAP: Record<string, string> = {
  '新品、未使用': 'New, unused',
  '未使用に近い': 'Like new',
  '目立った傷や汚れなし': 'No notable scratches or stains',
  'やや傷や汚れあり': 'Minor scratches or stains',
  '傷や汚れあり': 'Scratches or stains present',
  '全体的に状態が悪い': 'Poor overall condition',
}

export function mapConditionToEnglish(condition: string): string {
  return CONDITION_MAP[condition] ?? condition
}

function isValidMercariUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === 'jp.mercari.com' &&
      parsed.pathname.startsWith('/item/')
    )
  } catch {
    return false
  }
}

interface MercariItem {
  id?: string
  name: string
  price: number
  itemCondition?: string
  thumbnails?: string[]
  seller?: { ratings?: { good?: number; normal?: number; bad?: number } }
  shippingPayer?: string
}

function extractItem(data: unknown): MercariItem | null {
  // Try known __NEXT_DATA__ paths — defensive in case Mercari updates their structure
  const candidates = [
    () => (data as any)?.props?.pageProps?.item,
    () => (data as any)?.props?.pageProps?.serverProps?.item,
  ]
  for (const get of candidates) {
    try {
      const item = get()
      if (item && typeof item.name === 'string' && typeof item.price === 'number') {
        return item as MercariItem
      }
    } catch {}
  }
  return null
}

export async function fetchMercariListing(
  url: string
): Promise<MercariListing | MercariError> {
  if (!isValidMercariUrl(url)) {
    return { error: 'Invalid Mercari JP URL. Must start with https://jp.mercari.com/item/', step: 'mercari' }
  }

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8',
      },
    })
    if (!res.ok) {
      return {
        error: `Mercari JP returned ${res.status}. The listing may be blocked or unavailable. Try again.`,
        step: 'mercari',
      }
    }
    html = await res.text()
  } catch (err) {
    return { error: 'Could not reach Mercari JP. Check your connection.', step: 'mercari' }
  }

  const $ = cheerio.load(html)
  const nextDataText = $('#__NEXT_DATA__').text()
  if (!nextDataText) {
    return { error: 'Could not parse listing data — Mercari JP page structure may have changed.', step: 'mercari' }
  }

  let nextData: unknown
  try {
    nextData = JSON.parse(nextDataText)
  } catch {
    return { error: 'Could not parse listing data.', step: 'mercari' }
  }

  const item = extractItem(nextData)
  if (!item) {
    return { error: 'Could not find item data in listing page.', step: 'mercari' }
  }

  const good = item.seller?.ratings?.good ?? 0
  const normal = item.seller?.ratings?.normal ?? 0
  const bad = item.seller?.ratings?.bad ?? 0
  const total = good + normal + bad

  return {
    title_jp: item.name,
    images: item.thumbnails ?? [],
    price_jpy: item.price,
    condition: item.itemCondition ?? '',
    condition_en: mapConditionToEnglish(item.itemCondition ?? ''),
    seller_rating: total > 0 ? `${good} / ${total}` : 'N/A',
    shipping_included: item.shippingPayer === 'SELLER',
    url,
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/mercari.ts tests/mercari.test.ts
git commit -m "feat: add Mercari JP scraper with __NEXT_DATA__ parsing and condition mapping"
```

---

## Task 6: Google Translate Client (TDD)

**Files:**
- Create: `lib/translate.ts`
- Create: `tests/translate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/translate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateToEnglish } from '@/lib/translate'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('GOOGLE_TRANSLATE_API_KEY', 'test-key')
})

describe('translateToEnglish', () => {
  it('returns translated text from Google Translate API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { translations: [{ translatedText: 'Pikachu ex SAR' }] },
      }),
    }))

    const result = await translateToEnglish('ピカチュウex SAR')
    expect(result.text).toBe('Pikachu ex SAR')
    expect(result.failed).toBe(false)
  })

  it('POSTs to the correct endpoint with the API key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { translations: [{ translatedText: 'test' }] },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await translateToEnglish('テスト')
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('translation.googleapis.com')
    expect(url).toContain('test-key')
    const body = JSON.parse(options.body)
    expect(body.q).toBe('テスト')
    expect(body.source).toBe('ja')
    expect(body.target).toBe('en')
  })

  it('returns original text with failed=true when API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const result = await translateToEnglish('ピカチュウ')
    expect(result.text).toBe('ピカチュウ')
    expect(result.failed).toBe(true)
  })

  it('returns original text with failed=true when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }))
    const result = await translateToEnglish('テスト')
    expect(result.text).toBe('テスト')
    expect(result.failed).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL with `Cannot find module '@/lib/translate'`

- [ ] **Step 3: Implement lib/translate.ts**

Create `lib/translate.ts`:

```typescript
interface TranslateResult {
  text: string
  failed: boolean
}

export async function translateToEnglish(text: string): Promise<TranslateResult> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    return { text, failed: true }
  }

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'ja', target: 'en', format: 'text' }),
    })

    if (!res.ok) return { text, failed: true }

    const data = await res.json() as {
      data: { translations: Array<{ translatedText: string }> }
    }
    const translated = data.data.translations[0]?.translatedText
    if (!translated) return { text, failed: true }

    return { text: translated, failed: false }
  } catch {
    return { text, failed: true }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/translate.ts tests/translate.test.ts
git commit -m "feat: add Google Translate client with graceful fallback"
```

---

## Task 7: eBay Finding API Client (TDD)

**Files:**
- Create: `lib/ebay.ts`
- Create: `tests/ebay.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/ebay.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findSoldListings } from '@/lib/ebay'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('EBAY_APP_ID', 'test-app-id')
})

// Minimal eBay Finding API JSON response shape
function makeEbayResponse(items: object[]) {
  return {
    findCompletedItemsResponse: [{
      searchResult: [{
        '@count': String(items.length),
        item: items,
      }],
      ack: [{ __value__: 'Success' }],
    }],
  }
}

const SAMPLE_ITEM = {
  title: ['Pikachu ex SAR 180/165'],
  sellingStatus: [{ currentPrice: [{ __value__: '42.00', _currencyId: 'USD' }] }],
  listingInfo: [{ endTime: ['2025-04-08T12:00:00.000Z'] }],
  condition: [{ conditionDisplayName: ['Brand New'] }],
  viewItemURL: ['https://www.ebay.com/itm/123456'],
  galleryURL: ['https://thumbs.ebaystatic.com/img/test.jpg'],
}

describe('findSoldListings', () => {
  it('returns parsed eBay listings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeEbayResponse([SAMPLE_ITEM]),
    }))

    const listings = await findSoldListings('Pikachu ex SAR')
    expect(listings).toHaveLength(1)
    expect(listings[0].title).toBe('Pikachu ex SAR 180/165')
    expect(listings[0].price_usd).toBe(42.00)
    expect(listings[0].url).toBe('https://www.ebay.com/itm/123456')
    expect(listings[0].thumbnail).toBe('https://thumbs.ebaystatic.com/img/test.jpg')
  })

  it('calls the eBay Finding API with correct params', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeEbayResponse([]),
    })
    vi.stubGlobal('fetch', mockFetch)

    await findSoldListings('Pikachu ex SAR')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('svcs.ebay.com')
    expect(url).toContain('findCompletedItems')
    expect(url).toContain('SoldItemsOnly')
    expect(url).toContain('test-app-id')
  })

  it('returns empty array when no items found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        findCompletedItemsResponse: [{
          searchResult: [{ '@count': '0' }],
        }],
      }),
    }))
    const listings = await findSoldListings('nonexistent card xyz')
    expect(listings).toEqual([])
  })

  it('returns empty array when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const listings = await findSoldListings('test')
    expect(listings).toEqual([])
  })

  it('returns empty array when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const listings = await findSoldListings('test')
    expect(listings).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL with `Cannot find module '@/lib/ebay'`

- [ ] **Step 3: Implement lib/ebay.ts**

Create `lib/ebay.ts`:

```typescript
import type { EbayListing } from './types'

export type { EbayListing }

const EBAY_FINDING_API =
  'https://svcs.ebay.com/services/search/FindingService/v1'

export async function findSoldListings(query: string): Promise<EbayListing[]> {
  const appId = process.env.EBAY_APP_ID
  if (!appId) return []

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': query,
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '20',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
  })

  try {
    const res = await fetch(`${EBAY_FINDING_API}?${params}`)
    if (!res.ok) return []

    const data = await res.json() as any
    const result = data?.findCompletedItemsResponse?.[0]
    const items = result?.searchResult?.[0]?.item

    if (!Array.isArray(items)) return []

    return items.map((item: any): EbayListing => ({
      title: item.title?.[0] ?? '',
      price_usd: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? '0'),
      sold_date: item.listingInfo?.[0]?.endTime?.[0] ?? '',
      condition: item.condition?.[0]?.conditionDisplayName?.[0] ?? '',
      url: item.viewItemURL?.[0] ?? '',
      thumbnail: item.galleryURL?.[0] ?? '',
    }))
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ebay.ts tests/ebay.test.ts
git commit -m "feat: add eBay Finding API client for sold listings"
```

---

## Task 8: Streaming Analyze API Route

**Files:**
- Create: `app/api/analyze/route.ts`
- Create: `app/api/ebay-search/route.ts`

- [ ] **Step 1: Create the streaming analyze route**

Create `app/api/analyze/route.ts`:

```typescript
import { fetchMercariListing } from '@/lib/mercari'
import { translateToEnglish } from '@/lib/translate'
import { fetchExchangeRate } from '@/lib/exchange-rate'
import { findSoldListings } from '@/lib/ebay'
import type { AnalyzeChunk } from '@/lib/types'

export async function POST(request: Request) {
  const { url } = await request.json() as { url: string }

  const encoder = new TextEncoder()
  const send = (chunk: AnalyzeChunk) =>
    encoder.encode(JSON.stringify(chunk) + '\n')

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Scrape Mercari JP
        const mercariResult = await fetchMercariListing(url)
        if ('error' in mercariResult) {
          controller.enqueue(send({ type: 'error', message: mercariResult.error, step: 'mercari' }))
          controller.close()
          return
        }
        controller.enqueue(send({ type: 'mercari', data: mercariResult }))

        // Step 2: Translate + exchange rate in parallel
        const [translateResult, usdRate] = await Promise.all([
          translateToEnglish(mercariResult.title_jp),
          fetchExchangeRate(),
        ])
        controller.enqueue(send({
          type: 'meta',
          data: { title_en: translateResult.text, usd_rate: usdRate },
        }))

        // Step 3: eBay sold listings
        const listings = await findSoldListings(translateResult.text)
        controller.enqueue(send({
          type: 'ebay',
          data: { listings, total_results: listings.length },
        }))

      } catch (err) {
        controller.enqueue(send({
          type: 'error',
          message: 'An unexpected error occurred.',
          step: 'mercari',
        }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
```

- [ ] **Step 2: Create the eBay re-search route**

Create `app/api/ebay-search/route.ts`:

```typescript
import { findSoldListings } from '@/lib/ebay'

export async function POST(request: Request) {
  const { query } = await request.json() as { query: string }
  if (!query?.trim()) {
    return Response.json({ error: 'query is required' }, { status: 400 })
  }
  const listings = await findSoldListings(query.trim())
  return Response.json({ listings, total_results: listings.length })
}
```

- [ ] **Step 3: Verify the routes exist and TypeScript is happy**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/analyze/route.ts app/api/ebay-search/route.ts
git commit -m "feat: add streaming analyze route and eBay re-search route"
```

---

## Task 9: UI Components — UrlInput and MercariPanel

**Files:**
- Create: `components/UrlInput.tsx`
- Create: `components/MercariPanel.tsx`

- [ ] **Step 1: Create UrlInput component**

Create `components/UrlInput.tsx`:

```typescript
'use client'

interface UrlInputProps {
  onSubmit: (url: string) => void
  loading: boolean
}

export function UrlInput({ onSubmit, loading }: UrlInputProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const url = (form.elements.namedItem('url') as HTMLInputElement).value.trim()
    if (url) onSubmit(url)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
      <input
        name="url"
        type="url"
        placeholder="https://jp.mercari.com/item/m12345678"
        required
        className="
          flex-1 bg-zinc-900 border border-zinc-700 rounded-lg
          px-4 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-600
          focus:outline-none focus:border-blue-500
        "
      />
      <button
        type="submit"
        disabled={loading}
        className="
          bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700
          text-white font-semibold text-sm rounded-lg px-5 py-2.5
          transition-colors whitespace-nowrap
        "
      >
        {loading ? 'Searching…' : 'Compare →'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create MercariPanel component**

Create `components/MercariPanel.tsx`:

```typescript
import Image from 'next/image'
import type { MercariListing } from '@/lib/types'

interface MercariPanelProps {
  listing: MercariListing | null
  titleEn: string
  usdRate: number | null
  loading: boolean
  onEditTitle: (title: string) => void
}

export function MercariPanel({
  listing,
  titleEn,
  usdRate,
  loading,
  onEditTitle,
}: MercariPanelProps) {
  if (loading && !listing) {
    return (
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="aspect-square max-h-64 bg-zinc-800 animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  if (!listing) return null

  const priceUsd = usdRate ? (listing.price_jpy * usdRate).toFixed(2) : null

  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Big image */}
      <div className="relative aspect-square max-h-64 bg-zinc-800">
        {listing.images[0] ? (
          <Image
            src={listing.images[0]}
            alt={listing.title_jp}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">🃏</div>
        )}
        {listing.images.length > 1 && (
          <span className="absolute top-2 right-2 bg-black/60 text-zinc-400 text-xs rounded px-1.5 py-0.5">
            1 / {listing.images.length}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Mercari JP</p>
        <p className="text-xs text-zinc-500 mb-1">{listing.title_jp}</p>

        {/* Editable English title */}
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-semibold text-blue-400 flex-1 min-w-0 truncate">
            {titleEn || listing.title_jp}
          </p>
          <button
            onClick={() => {
              const next = prompt('Edit search title:', titleEn || listing.title_jp)
              if (next !== null) onEditTitle(next)
            }}
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-500 rounded px-1.5 py-0.5 flex-shrink-0 hover:text-zinc-300 transition-colors"
          >
            edit
          </button>
        </div>

        <p className="text-xl font-bold text-green-400">
          ¥{listing.price_jpy.toLocaleString()}
        </p>
        {priceUsd && (
          <p className="text-xs text-zinc-500 mt-0.5 mb-3">≈ ${priceUsd} USD</p>
        )}

        <div className="border-t border-zinc-800 pt-3 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500">Condition</span>
            <span className="text-xs text-zinc-300">{listing.condition_en}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500">Seller rating</span>
            <span className="text-xs text-amber-400">★ {listing.seller_rating}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500">Shipping (JP)</span>
            <span className="text-xs text-zinc-300">
              {listing.shipping_included ? 'Included' : 'Buyer pays'}
            </span>
          </div>
        </div>

        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs text-blue-400 hover:underline"
        >
          ↗ View on Mercari JP
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/UrlInput.tsx components/MercariPanel.tsx
git commit -m "feat: add UrlInput and MercariPanel components"
```

---

## Task 10: UI Components — EbayPanel

**Files:**
- Create: `components/EbayPanel.tsx`

- [ ] **Step 1: Create EbayPanel component**

Create `components/EbayPanel.tsx`:

```typescript
'use client'

import Image from 'next/image'
import type { EbayListing } from '@/lib/types'

interface EbayPanelProps {
  listings: EbayListing[] | null
  searchQuery: string
  loading: boolean
  onReSearch: (query: string) => void
}

export function EbayPanel({ listings, searchQuery, loading, onReSearch }: EbayPanelProps) {
  if (loading && !listings) {
    return (
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">eBay Sold Listings</p>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3 animate-pulse">
              <div className="w-12 h-12 bg-zinc-700 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-zinc-700 rounded w-3/4" />
                <div className="h-2.5 bg-zinc-700 rounded w-1/3" />
              </div>
              <div className="h-4 bg-zinc-700 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!listings) return null

  function handleEditSearch() {
    const next = prompt('Edit eBay search query:', searchQuery)
    if (next !== null && next.trim()) onReSearch(next.trim())
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-widest">eBay Sold Listings</p>
        <span className="text-xs text-zinc-500">{listings.length} results</span>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <p className="text-sm mb-2">No sold listings found.</p>
          <button onClick={handleEditSearch} className="text-xs text-blue-400 hover:underline">
            Try a different search term
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((listing, i) => (
            <a
              key={i}
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700
                border border-transparent hover:border-zinc-600
                rounded-lg p-2.5 transition-colors no-underline
              "
            >
              <div className="relative w-12 h-12 flex-shrink-0 bg-zinc-700 rounded-lg overflow-hidden">
                {listing.thumbnail ? (
                  <Image
                    src={listing.thumbnail}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xl">🃏</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate">{listing.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formatDate(listing.sold_date)}{listing.condition ? ` · ${listing.condition}` : ''}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-green-400">
                  ${listing.price_usd.toFixed(2)}
                </p>
                <p className="text-xs text-zinc-600">↗</p>
              </div>
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-zinc-600 text-right">
        Searching: "{searchQuery}" ·{' '}
        <button onClick={handleEditSearch} className="text-blue-400 hover:underline">
          edit search
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/EbayPanel.tsx
git commit -m "feat: add EbayPanel component with thumbnails, links, and re-search"
```

---

## Task 11: ArbitrageBar Component

**Files:**
- Create: `components/ArbitrageBar.tsx`

- [ ] **Step 1: Create ArbitrageBar component**

Create `components/ArbitrageBar.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { calculateFees, DEFAULT_FEE_INPUTS } from '@/lib/fees'
import type { EbayListing, FeeInputs } from '@/lib/types'

interface ArbitrageBarProps {
  mercariPriceJpy: number
  usdRate: number
  listings: EbayListing[]
}

export function ArbitrageBar({ mercariPriceJpy, usdRate, listings }: ArbitrageBarProps) {
  const [feeInputs, setFeeInputs] = useState<Omit<FeeInputs, 'mercariPriceJpy' | 'usdRate'>>({
    buyeeServiceFeeJpy: DEFAULT_FEE_INPUTS.buyeeServiceFeeJpy,
    buyeeDomesticShipJpy: DEFAULT_FEE_INPUTS.buyeeDomesticShipJpy,
    intlShippingUsd: DEFAULT_FEE_INPUTS.intlShippingUsd,
    ebayDomesticShipUsd: DEFAULT_FEE_INPUTS.ebayDomesticShipUsd,
    ebayFvfPct: DEFAULT_FEE_INPUTS.ebayFvfPct,
    ebayPerOrderFee: DEFAULT_FEE_INPUTS.ebayPerOrderFee,
  })

  const salePrices = listings.map(l => l.price_usd).filter(p => p > 0)
  if (salePrices.length === 0) return null

  const fees = calculateFees(
    { mercariPriceJpy, usdRate, ...feeInputs },
    salePrices
  )

  function update(key: keyof typeof feeInputs, raw: string) {
    const val = parseFloat(raw)
    if (!isNaN(val) && val >= 0) {
      setFeeInputs(prev => ({ ...prev, [key]: val }))
    }
  }

  const profitColor = (n: number) =>
    n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-zinc-400'

  const fmt = (n: number) =>
    `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`

  return (
    <div className="bg-emerald-950 border border-emerald-900 rounded-xl p-5">

      {/* Headline */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <p className="text-xs text-emerald-300 uppercase tracking-widest mb-1">
            Net Profit After Fees
          </p>
          <p className={`text-3xl font-extrabold leading-none ${profitColor(fees.profitFreeShip)}`}>
            {fmt(fees.profitFreeShip)}{' '}
            <span className="text-lg text-emerald-400">
              {fees.avgSalePrice > 0
                ? `${((fees.profitFreeShip / fees.avgSalePrice) * 100).toFixed(0)}%`
                : ''}
            </span>
          </p>
          <p className="text-xs text-emerald-400 mt-1">
            Based on eBay avg sold price of ${fees.avgSalePrice.toFixed(2)} · free shipping
          </p>
        </div>

        <div className="flex gap-5">
          <Stat label="Best Case" value={fmt(calculateFees({ mercariPriceJpy, usdRate, ...feeInputs }, [fees.highSalePrice]).profitFreeShip)} positive={calculateFees({ mercariPriceJpy, usdRate, ...feeInputs }, [fees.highSalePrice]).profitFreeShip > 0} />
          <Stat label="Avg" value={fmt(fees.profitFreeShip)} positive={fees.profitFreeShip > 0} />
          <div className="text-center">
            <p className="text-xs text-emerald-300 uppercase tracking-widest mb-1">Break-Even</p>
            <p className="text-sm font-semibold text-amber-400">${fees.breakEvenFreeShip.toFixed(2)}</p>
          </div>
          <Stat label="Worst Case" value={fmt(calculateFees({ mercariPriceJpy, usdRate, ...feeInputs }, [fees.lowSalePrice]).profitFreeShip)} positive={calculateFees({ mercariPriceJpy, usdRate, ...feeInputs }, [fees.lowSalePrice]).profitFreeShip > 0} />
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="flex flex-wrap gap-6 border-t border-emerald-900 pt-4">

        {/* Costs */}
        <div className="flex-1 min-w-48">
          <p className="text-xs text-emerald-300 uppercase tracking-widest mb-2">Total Cost</p>
          <FeeRow label="Mercari price" value={`¥${mercariPriceJpy.toLocaleString()} ($${(mercariPriceJpy * usdRate).toFixed(2)})`} />
          <FeeRow label="Buyee service fee" value={`¥${feeInputs.buyeeServiceFeeJpy} ($${(feeInputs.buyeeServiceFeeJpy * usdRate).toFixed(2)})`} />
          <FeeRow label="Japan domestic ship" value={`¥${feeInputs.buyeeDomesticShipJpy} ($${(feeInputs.buyeeDomesticShipJpy * usdRate).toFixed(2)})`} />
          <EditableFeeRow label="Intl. shipping (est.)" prefix="$" value={feeInputs.intlShippingUsd} onChange={v => update('intlShippingUsd', v)} />
          <EditableFeeRow label="eBay domestic ship" prefix="$" value={feeInputs.ebayDomesticShipUsd} onChange={v => update('ebayDomesticShipUsd', v)} />
          <div className="border-t border-emerald-900 mt-1.5 pt-1.5 flex justify-between">
            <span className="text-xs font-bold text-emerald-300">Total cost</span>
            <span className="text-xs font-bold text-zinc-200">${fees.totalCostFreeShip.toFixed(2)}</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="flex-1 min-w-48">
          <p className="text-xs text-emerald-300 uppercase tracking-widest mb-2">Revenue After eBay Fees</p>
          <FeeRow label="eBay avg sale price" value={`$${fees.avgSalePrice.toFixed(2)}`} />
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-zinc-400">eBay final value fee</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={feeInputs.ebayFvfPct}
                onChange={e => update('ebayFvfPct', e.target.value)}
                className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 text-center"
                step="0.01"
                min="0"
                max="100"
              />
              <span className="text-xs text-zinc-500">%</span>
            </div>
          </div>
          <FeeRow label="eBay per-order fee" value={`$${feeInputs.ebayPerOrderFee.toFixed(2)}`} />
          <FeeRow label="eBay deduction" value={`−$${fees.ebayDeductionFreeShip.toFixed(2)}`} negative />
          <div className="border-t border-emerald-900 mt-1.5 pt-1.5 flex justify-between">
            <span className="text-xs font-bold text-emerald-300">Net revenue</span>
            <span className="text-xs font-bold text-zinc-200">${fees.netRevenueFreeShip.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Shipping toggle */}
      <div className="flex flex-wrap items-center gap-3 mt-4 border-t border-emerald-900 pt-4">
        <span className="text-xs text-emerald-300 uppercase tracking-widest">eBay listing:</span>
        <span className="text-xs bg-emerald-900 border border-emerald-700 text-green-400 font-semibold rounded px-2.5 py-1">
          Free shipping
        </span>
        <span className="text-xs border border-emerald-900 text-emerald-400 rounded px-2.5 py-1">
          Buyer pays shipping
        </span>
        <div className="ml-auto flex gap-4">
          <div className="text-center">
            <p className="text-xs text-emerald-400">Free ship profit</p>
            <p className={`text-sm font-bold ${profitColor(fees.profitFreeShip)}`}>{fmt(fees.profitFreeShip)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-emerald-400">Buyer pays profit</p>
            <p className={`text-sm font-bold ${profitColor(fees.profitBuyerShip)}`}>{fmt(fees.profitBuyerShip)}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-700 border-t border-emerald-900 pt-3 mt-3">
        eBay fee defaults: {feeInputs.ebayFvfPct}% final value + ${feeInputs.ebayPerOrderFee.toFixed(2)}/order. Buyee: ¥{feeInputs.buyeeServiceFeeJpy} service + ¥{feeInputs.buyeeDomesticShipJpy} domestic. Exchange rate: ¥1 = ${usdRate.toFixed(5)}. All estimates — actual costs vary.
      </p>
    </div>
  )
}

function Stat({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs text-emerald-300 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>{value}</p>
    </div>
  )
}

function FeeRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between mb-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-xs ${negative ? 'text-red-400' : 'text-zinc-200'}`}>{value}</span>
    </div>
  )
}

function EditableFeeRow({
  label, prefix, value, onChange,
}: {
  label: string; prefix: string; value: number; onChange: (v: string) => void
}) {
  return (
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-zinc-200">{prefix}</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 text-center"
          step="0.01"
          min="0"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/ArbitrageBar.tsx
git commit -m "feat: add ArbitrageBar with editable fee fields and free/buyer-pays comparison"
```

---

## Task 12: Main Page — Wire Everything Together

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement app/page.tsx**

Replace the contents of `app/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { UrlInput } from '@/components/UrlInput'
import { MercariPanel } from '@/components/MercariPanel'
import { EbayPanel } from '@/components/EbayPanel'
import { ArbitrageBar } from '@/components/ArbitrageBar'
import type { AnalyzeChunk, MercariListing, EbayListing } from '@/lib/types'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function Home() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [mercari, setMercari] = useState<MercariListing | null>(null)
  const [titleEn, setTitleEn] = useState('')
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [listings, setListings] = useState<EbayListing[] | null>(null)

  async function handleSubmit(url: string) {
    setStatus('loading')
    setError(null)
    setMercari(null)
    setTitleEn('')
    setUsdRate(null)
    setListings(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          const chunk = JSON.parse(line) as AnalyzeChunk

          if (chunk.type === 'mercari') {
            setMercari(chunk.data)
          } else if (chunk.type === 'meta') {
            setTitleEn(chunk.data.title_en)
            setUsdRate(chunk.data.usd_rate)
          } else if (chunk.type === 'ebay') {
            setListings(chunk.data.listings)
            setStatus('done')
          } else if (chunk.type === 'error') {
            setError(chunk.message)
            setStatus('error')
          }
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  async function handleReSearch(query: string) {
    setTitleEn(query)
    setListings(null)
    setStatus('loading')

    try {
      const res = await fetch('/api/ebay-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json() as { listings: EbayListing[] }
      setListings(data.listings)
      setStatus('done')
    } catch {
      setStatus('done') // don't wipe existing results on re-search failure
    }
  }

  const loading = status === 'loading'

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-6">
        Mercari Compare
      </h1>

      <UrlInput onSubmit={handleSubmit} loading={loading} />

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-6 text-sm text-red-300">
          {error}
        </div>
      )}

      {(loading || mercari) && (
        <>
          <div className="flex gap-4 mb-4">
            <MercariPanel
              listing={mercari}
              titleEn={titleEn}
              usdRate={usdRate}
              loading={loading}
              onEditTitle={(next) => {
                setTitleEn(next)
                handleReSearch(next)
              }}
            />
            <EbayPanel
              listings={listings}
              searchQuery={titleEn}
              loading={loading}
              onReSearch={handleReSearch}
            />
          </div>

          {mercari && usdRate && listings && listings.length > 0 && (
            <ArbitrageBar
              mercariPriceJpy={mercari.price_jpy}
              usdRate={usdRate}
              listings={listings}
            />
          )}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Run the dev server and test manually**

```bash
npm run dev
```

Open http://localhost:3000. Paste a real Mercari JP listing URL (e.g. `https://jp.mercari.com/item/m12345678`). Verify:
- Left panel loads with Mercari image and details
- Translated English title appears
- eBay sold listings appear in right panel with thumbnails
- Arbitrage bar appears at bottom with fee breakdown
- Editable fields recompute profit in real time
- Clicking an eBay row opens the listing in a new tab

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire main page with streaming, re-search, and arbitrage bar"
```

---

## Task 13: Deploy to Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

Create `vercel.json`:

```json
{
  "functions": {
    "app/api/analyze/route.ts": {
      "maxDuration": 30
    }
  }
}
```

The analyze route needs 30s max because it calls three external APIs sequentially. The default is 10s on Vercel hobby plan.

- [ ] **Step 2: Push to GitHub**

Create a new GitHub repo named `compare-app` at github.com, then:

```bash
git remote add origin https://github.com/<your-username>/compare-app.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Deploy on Vercel**

1. Go to vercel.com → New Project → Import `compare-app` from GitHub
2. Framework Preset: **Next.js** (auto-detected)
3. Add environment variables:
   - `GOOGLE_TRANSLATE_API_KEY` → your Google Translate API key
   - `EBAY_APP_ID` → your eBay App ID (Client ID)
4. Click **Deploy**

- [ ] **Step 4: Verify production deployment**

Once deployed, open the Vercel URL and test with a real Mercari JP listing. Confirm all three panels load and the arbitrage bar computes.

- [ ] **Step 5: Commit vercel.json**

```bash
git add vercel.json
git commit -m "chore: add vercel.json with 30s timeout for analyze route"
git push
```

---

## API Keys Setup Reference

**eBay Developer App ID:**
1. Go to developer.ebay.com → My Account → Application Keys
2. Create a production app
3. Copy the **App ID (Client ID)**

**Google Cloud Translation API Key:**
1. Go to console.cloud.google.com
2. Enable the **Cloud Translation API**
3. Go to Credentials → Create Credentials → API Key
4. Copy the key (optionally restrict it to Translation API)
