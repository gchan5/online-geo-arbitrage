# Mercari JP → eBay Arbitrage Comparison App

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

A dark-mode web app hosted on Vercel that lets the user paste a Mercari JP listing URL and see matching sold listings on eBay, along with a full arbitrage profit estimate after fees. Targeted at Pokemon TCG and other collectibles for geographic arbitrage between Japan and US markets.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Native Vercel support, streaming, serverless functions |
| Language | TypeScript | Type safety across API payloads |
| Styling | Tailwind CSS | Dark mode utility classes, fast iteration |
| HTML parsing | cheerio | Server-side parse of Mercari `__NEXT_DATA__` JSON |
| Exchange rate | Frankfurter.app | Free, no API key, reliable JPY→USD |
| Translation | Google Cloud Translation API v2 (Basic) | Reliable, free tier (500k chars/month) |
| eBay data | eBay Finding API (`findCompletedItems`) | Official API for sold/completed listings |
| Hosting | Vercel | Serverless functions, free tier, easy deploy |

---

## Environment Variables

```
GOOGLE_TRANSLATE_API_KEY=...
EBAY_APP_ID=...           # Client ID from eBay Developer account
```

---

## Architecture

### Request Flow

```
User pastes Mercari URL
        ↓
POST /api/analyze  (Next.js Route Handler, Node.js runtime)
        ↓ stream chunk 1
  fetch(mercari_url) → parse __NEXT_DATA__ JSON
  extract: title_jp, price_jpy, images[], condition, item_id
        ↓ stream chunk 2
  parallel:
    Google Translate API  → title_en (editable by user)
    Frankfurter.app       → jpy_to_usd rate
        ↓ stream chunk 3
  eBay Finding API findCompletedItems
    query: title_en
    filter: soldItemsOnly=true
    returns: sold_listings[]
        ↓
  client computes arbitrage stats from sold_listings + fees
```

The API route returns **newline-delimited JSON (NDJSON)** over a streaming `Response`. The client reads the stream incrementally and updates React state as each chunk arrives.

### Stream Chunk Schema

```ts
// Chunk 1 — Mercari data
{ type: "mercari", data: {
    title_jp: string,
    images: string[],
    price_jpy: number,
    condition: string,
    condition_en: string,   // hardcoded map of JP condition labels
    seller_rating: string,
    url: string
}}

// Chunk 2 — Translation + exchange rate
{ type: "meta", data: {
    title_en: string,       // editable by user before eBay search
    usd_rate: number        // e.g. 0.00668
}}

// Chunk 3 — eBay sold listings
{ type: "ebay", data: {
    listings: Array<{
        title: string,
        price_usd: number,
        sold_date: string,
        condition: string,
        url: string,          // viewItemURL — eBay listing page
        thumbnail: string     // galleryURL from Finding API
    }>,
    total_results: number
}}

// Error
{ type: "error", message: string, step: "mercari" | "translate" | "ebay" }
```

---

## File Structure

```
app/
  page.tsx                    ← root page (client component, orchestrates UI state)
  globals.css                 ← Tailwind base, dark mode root
  api/
    analyze/
      route.ts                ← streaming POST handler (Mercari + translate + eBay)
    ebay-search/
      route.ts                ← lightweight POST handler for re-search by title only
lib/
  mercari.ts                  ← fetch Mercari JP page, parse __NEXT_DATA__
  ebay.ts                     ← eBay Finding API findCompletedItems
  translate.ts                ← Google Translate REST call
  exchange-rate.ts            ← Frankfurter.app JPY→USD fetch
  fees.ts                     ← arbitrage calculation logic (pure functions)
components/
  UrlInput.tsx                ← URL input bar + submit button
  MercariPanel.tsx            ← left panel: card image, JP/EN name, price, details
  EbayPanel.tsx               ← right panel: sold listings list + edit search
  ArbitrageBar.tsx            ← bottom dashboard: profit, fee breakdown, ship toggle
```

---

## UI Layout

**Full-width dark app (`#09090b` background, zinc color scale)**

```
┌─────────────────────────────────────────────────┐
│  [ Paste Mercari JP URL…              ] [Compare]│
├───────────────────────┬─────────────────────────┤
│  MERCARI JP           │  EBAY SOLD LISTINGS     │
│  [card image]         │  Title · Date · Cond    │
│  ピカチュウex SAR      │  $42.00                 │
│  Pikachu ex SAR [edit]│  $35.00                 │
│  ¥3,200 / ~$21.40     │  $38.50  ...            │
│  Condition / Rating   │  [edit search]          │
│  ↗ View on Mercari    │                         │
├───────────────────────┴─────────────────────────┤
│  NET PROFIT AFTER FEES                          │
│  +$2.66  +8%    Best/Avg/Break-even/Worst       │
│  ──────────────────────────────────────────── │
│  COSTS               REVENUE AFTER EBAY FEES   │
│  Mercari ¥3,200      eBay avg $38.00            │
│  Buyee svc ¥300      eBay FVF [13.25]% [edit]  │
│  JP domestic ¥500    eBay per-order $0.30       │
│  Intl. ship [$10][e] eBay deduction  −$5.34     │
│  eBay domestic[$4.50]Net revenue     $32.36     │
│  Total cost $41.26                              │
│  ──────────────────────────────────────────── │
│  [Free shipping] [Buyer pays]  Free: +$2.66     │
│                                Buyer pays:+$7.16│
└─────────────────────────────────────────────────┘
```

- Mercari panel and eBay panel are side-by-side columns
- Arbitrage bar spans full width at the bottom
- All `[edit]` fields are inline inputs that recompute profit on change
- Free shipping / Buyer pays toggle shows both profits simultaneously

**Mercari panel image:** Full-width image at the top of the left panel (square aspect ratio, max-height 260px), with a "1 / N photos" badge. Info (JP name, translated name, price, details) sits below the image.

**eBay listing rows:** Each row shows a 48×48 thumbnail (from `galleryURL` in the Finding API response), title + date/condition, and price with a ↗ arrow. The entire row is an `<a>` tag linking to the eBay listing (`viewItemURL`) opening in a new tab. Row has a hover state.

---

## Fee Calculation Logic (`lib/fees.ts`)

### Inputs
| Field | Default | Editable |
|---|---|---|
| `mercari_price_jpy` | from Mercari | No |
| `usd_rate` | from Frankfurter | No |
| `buyee_service_fee_jpy` | ¥300 | No |
| `buyee_domestic_ship_jpy` | ¥500 | No |
| `intl_shipping_usd` | $10.00 | Yes |
| `ebay_domestic_ship_usd` | $4.50 | Yes |
| `ebay_fvf_pct` | 13.25 | Yes |
| `ebay_per_order_fee` | $0.30 | No |

### Calculations

```
total_cost_usd = (mercari_price_jpy + buyee_service_fee_jpy + buyee_domestic_ship_jpy) * usd_rate
              + intl_shipping_usd

// Free shipping scenario (seller pays domestic)
total_cost_free_ship = total_cost_usd + ebay_domestic_ship_usd
ebay_deduction_free  = sale_price * (ebay_fvf_pct / 100) + ebay_per_order_fee
net_revenue_free     = sale_price - ebay_deduction_free
profit_free          = net_revenue_free - total_cost_free_ship

// Buyer pays shipping scenario
// Note: eBay charges FVF on the full transaction (item + shipping charged),
// so the seller pays FVF on the shipping amount even though it goes to the carrier.
total_cost_buyer_ship = total_cost_usd
ebay_deduction_buyer  = (sale_price + ebay_domestic_ship_usd) * (ebay_fvf_pct / 100) + ebay_per_order_fee
net_revenue_buyer     = sale_price - ebay_deduction_buyer   // shipping goes to carrier, not profit
profit_buyer          = net_revenue_buyer - total_cost_buyer_ship

// Stats computed over all sold_listings
avg_price    = mean(sold_listings.price_usd)
median_price = median(sold_listings.price_usd)
high_price   = max(sold_listings.price_usd)
low_price    = min(sold_listings.price_usd)

// Break-even: minimum eBay sale price to cover all costs (free ship scenario)
// Derived from: sale_price * (1 - fvf) - per_order - total_cost = 0
break_even = (total_cost_free_ship + ebay_per_order_fee) / (1 - ebay_fvf_pct / 100)
```

---

## Mercari JP Scraping (`lib/mercari.ts`)

- Server-side `fetch(url)` with a browser-like `User-Agent` header
- Parse `<script id="__NEXT_DATA__">` JSON from the HTML response
- Navigate to item data: `json.props.pageProps.item`
- Extract: `name`, `price`, `itemCondition`, `thumbnails[]`, `seller.ratings`
- If `__NEXT_DATA__` is absent or item data missing: return error chunk with `step: "mercari"`
- No Puppeteer/Playwright — direct fetch only. If blocked, caller sees a clear error message prompting user to try again.

---

## eBay Finding API (`lib/ebay.ts`)

- Endpoint: `findCompletedItems`, response format: JSON (`RESPONSE-DATA-FORMAT=JSON`)
- Key params: `keywords=<title_en>`, `sortOrder=EndTimeSoonest`, `itemFilter[0].name=SoldItemsOnly&itemFilter[0].value=true`
- Returns up to 20 results
- App ID passed via `EBAY_APP_ID` env var
- **Re-search behavior:** when the user edits `title_en` and triggers a new eBay search, only `/api/ebay-search` is called (a separate lightweight route) — Mercari is not re-scraped and the left panel does not change

---

## Translation (`lib/translate.ts`)

- Single REST call to Google Cloud Translation API v2
- Source: `ja`, Target: `en`
- Input: `title_jp` from Mercari
- Returns `title_en` — shown in an editable field; user can correct before eBay search triggers
- If translation fails: return raw `title_jp`, flag as untranslated, let user enter manually

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Mercari fetch blocked / 403 | Error shown in left panel: "Could not fetch listing. Try again." |
| `__NEXT_DATA__` missing | Error shown in left panel: "Could not parse listing data." |
| Translation fails | Shows raw JP title, marks it as untranslated, user can edit |
| Exchange rate API down | Falls back to hardcoded rate (¥1 = $0.0067), shown with "(cached rate)" label |
| eBay returns 0 results | Shows "No sold listings found" with suggestion to edit search term |
| eBay API error | Shows error in right panel with retry option |

---

## Deployment

- Vercel project connected to GitHub repo
- Environment variables set in Vercel dashboard
- No database, no auth, no sessions — fully stateless
- `.superpowers/` added to `.gitignore`
