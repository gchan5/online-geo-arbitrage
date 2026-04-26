# Online Geo-Arbitrage

A dark-mode web app for finding geographic arbitrage opportunities between Mercari Japan and eBay US — targeted at Pokemon TCG and other collectibles.

Paste a Mercari JP listing URL and instantly see matching eBay sold listings alongside a full profit estimate after all fees.

## Features

- **Mercari JP scraping** — pulls listing image, title, price, condition, and seller rating directly from the page
- **Auto-translation** — translates the Japanese item name to English via Google Translate (editable before search)
- **eBay sold listings** — searches eBay's Browse API using OAuth app tokens, with thumbnails and direct links
- **Arbitrage dashboard** — calculates net profit after all fees:
  - Buyee proxy service fee (¥300) + Japan domestic shipping (¥500)
  - International shipping (editable, default $10)
  - eBay final value fee (editable, default 13.25%)
  - eBay per-order fee ($0.30)
  - eBay domestic shipping (editable, default $4.50)
- **Dual shipping scenarios** — shows profit for both "free shipping" and "buyer pays" simultaneously
- **Best / Avg / Worst / Break-even** stats across all sold listings
- **Re-search** — edit the translated title and re-query eBay without re-scraping Mercari

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS (dark mode)
- [eBay Buy Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html) — listing search
- [Google Cloud Translation API v2](https://cloud.google.com/translate/docs/reference/rest) — JP → EN
- [Frankfurter](https://www.frankfurter.app/) — live JPY → USD exchange rate
- [Buyee](https://buyee.jp/) fee model for Japan proxy purchasing
- Deployed on [Vercel](https://vercel.com/)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/gchan5/online-geo-arbitrage.git
cd online-geo-arbitrage
npm install
```

### 2. Environment variables

Copy the example file and fill in your keys:

```bash
cp .env.local.example .env.local
```

```
GOOGLE_TRANSLATE_API_KEY=   # Google Cloud Translation API key
EBAY_CLIENT_ID=             # eBay OAuth Client ID
EBAY_CLIENT_SECRET=         # eBay OAuth Client Secret
EBAY_MARKETPLACE_ID=EBAY_US # Optional, defaults to EBAY_US
```

**Getting API keys:**

- **eBay OAuth credentials:** [developer.ebay.com](https://developer.ebay.com) → My Account → Application Keys → create a Production app → copy Client ID and Client Secret
- **Google Translate key:** [console.cloud.google.com](https://console.cloud.google.com) → enable Cloud Translation API → Credentials → Create API Key

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a Mercari JP listing URL (e.g. `https://jp.mercari.com/item/m12345678`), and click Compare.

## Deploy to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com](https://vercel.com) → New Project
3. Add `GOOGLE_TRANSLATE_API_KEY`, `EBAY_CLIENT_ID`, and `EBAY_CLIENT_SECRET` as environment variables
4. Deploy — the `vercel.json` already sets a 30s timeout on the analyze route

## How It Works

```
User pastes Mercari URL
        ↓
POST /api/analyze  (streaming NDJSON)
        ↓ chunk 1
  Scrape Mercari JP → title, price, images, condition
        ↓ chunk 2
  Google Translate → English title
  Frankfurter      → JPY/USD rate
        ↓ chunk 3
  eBay Browse API + OAuth app token → listings
        ↓
  Client computes arbitrage stats from sold prices + fees
```

## Running Tests

```bash
npm test
```

Unit tests cover fee calculation, Mercari scraping, eBay API client, translation, and exchange rate modules.
