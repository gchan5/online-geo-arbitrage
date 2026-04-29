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

function isValidBuyeeAuctionUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === 'buyee.jp' &&
      /^\/item\/jdirectitems\/auction\/[a-z]\d+$/i.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

function isSupportedListingUrl(url: string): boolean {
  return isValidMercariUrl(url) || isValidBuyeeAuctionUrl(url)
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

function getMetaContent($: cheerio.CheerioAPI, key: string): string {
  return (
    $(`meta[property="${key}"]`).attr('content') ??
    $(`meta[name="${key}"]`).attr('content') ??
    ''
  ).trim()
}

function stripMercariTitleSuffix(title: string): string {
  return title.replace(/\s*by メルカリ$/, '').trim()
}

function stripBuyeeTitleSuffix(title: string): string {
  return title
    .replace(/\s*\/\s*【Buyee】.*$/i, '')
    .replace(/\s*-\s*Japanese Proxy Service.*$/i, '')
    .trim()
}

function parseYenAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  return Number.parseInt(digits, 10)
}

function extractListingFromMeta(
  $: cheerio.CheerioAPI,
  url: string
): MercariListing | null {
  const rawTitle = getMetaContent($, 'og:title')
  const rawPrice = getMetaContent($, 'product:price:amount')
  const image = getMetaContent($, 'og:image')
  const price = Number.parseInt(rawPrice, 10)

  if (!rawTitle || Number.isNaN(price)) {
    return null
  }

  return {
    title_jp: stripMercariTitleSuffix(rawTitle),
    images: image ? [image] : [],
    price_jpy: price,
    condition: '',
    condition_en: '',
    seller_rating: 'N/A',
    shipping_included: false,
    url,
  }
}

function extractBuyeeListingFromPage(
  $: cheerio.CheerioAPI,
  url: string
): MercariListing | null {
  const rawTitle = getMetaContent($, 'og:title') || $('title').text().trim()
  const title = stripBuyeeTitleSuffix(rawTitle)
  if (!title) return null

  const image = getMetaContent($, 'og:image')
  const text = $('body').text().replace(/\s+/g, ' ')
  const currentPriceMatch =
    text.match(/Current Price\s*([\d,]+)\s*YEN/i) ||
    text.match(/Starting Price\s*([\d,]+)\s*YEN/i)
  const buyoutMatch = text.match(/Buyout Price\s*([\d,]+)\s*YEN/i)

  const price_jpy = currentPriceMatch
    ? parseYenAmount(currentPriceMatch[1])
    : (buyoutMatch ? parseYenAmount(buyoutMatch[1]) : Number.NaN)
  if (Number.isNaN(price_jpy)) return null

  const conditionMatch = text.match(/Item Condition\s*([^0-9]+?)(?:Starting Price|Current Price|Item Quantity)/i)
  const condition = conditionMatch?.[1]?.trim() ?? ''
  const ratingMatch = text.match(/Percentage of good ratings\s*([\d.]+%?)/i)
  const shippingMatch = text.match(/Domestic Shipping Fee Responsibility\s*(Winner|Seller)/i)

  return {
    title_jp: title,
    images: image ? [image] : [],
    price_jpy,
    condition,
    condition_en: condition,
    seller_rating: ratingMatch?.[1] ?? 'N/A',
    shipping_included: (shippingMatch?.[1]?.toLowerCase() ?? '') === 'seller',
    url,
  }
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
  if (!isSupportedListingUrl(url)) {
    return {
      error: 'Invalid URL. Use a Mercari JP item URL or a Buyee JDirectItems auction URL.',
      step: 'mercari',
    }
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
        error: `Listing page returned ${res.status}. The listing may be blocked or unavailable. Try again.`,
        step: 'mercari',
      }
    }
    html = await res.text()
  } catch (err) {
    return { error: 'Could not reach listing page. Check your connection.', step: 'mercari' }
  }

  const $ = cheerio.load(html)
  if (isValidBuyeeAuctionUrl(url)) {
    const buyeeListing = extractBuyeeListingFromPage($, url)
    if (buyeeListing) {
      return buyeeListing
    }
    return { error: 'Could not parse listing data — Buyee page structure may have changed.', step: 'mercari' }
  }

  const nextDataText = $('#__NEXT_DATA__').text()
  if (!nextDataText) {
    const listingFromMeta = extractListingFromMeta($, url)
    if (listingFromMeta) {
      return listingFromMeta
    }
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
    const listingFromMeta = extractListingFromMeta($, url)
    if (listingFromMeta) {
      return listingFromMeta
    }
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
