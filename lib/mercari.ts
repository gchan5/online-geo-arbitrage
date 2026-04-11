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
