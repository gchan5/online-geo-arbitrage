import type { EbayListing } from './types'

export type { EbayListing }

const EBAY_OAUTH_API = 'https://api.ebay.com/identity/v1/oauth2/token'
const EBAY_BROWSE_API = 'https://api.ebay.com/buy/browse/v1/item_summary/search'
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope'
const EBAY_MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID ?? 'EBAY_US'
const CACHE_TTL_MS = 15 * 60 * 1000
const soldListingsCache = new Map<string, { expiresAt: number; listings: EbayListing[] }>()
let tokenCache: { accessToken: string; expiresAt: number } | null = null

export function resetEbayCacheForTests() {
  soldListingsCache.clear()
  tokenCache = null
}

function normalizeQueryForBrowse(query: string): string {
  const ascii = query
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return ascii || query.trim()
}

function buildFallbackQueries(normalizedQuery: string): string[] {
  const variants: string[] = []
  const seen = new Set<string>()
  const add = (value: string) => {
    const next = value.trim().replace(/\s+/g, ' ')
    if (!next || seen.has(next)) return
    seen.add(next)
    variants.push(next)
  }

  add(normalizedQuery)
  add(normalizedQuery.replace(/\bset of \d+\b/gi, ''))
  add(normalizedQuery.replace(/\b(set|lot|bundle|sealed|booster)\b/gi, ''))
  const tokens = normalizedQuery.split(' ').filter(Boolean)
  if (tokens.length > 4) add(tokens.slice(0, 4).join(' '))
  if (tokens.length > 2) add(tokens.slice(0, 2).join(' '))

  return variants
}

async function getEbayAccessToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.accessToken

  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.warn('[ebay] missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET')
    return null
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: EBAY_SCOPE,
  })
  let tokenRes: Response
  try {
    tokenRes = await fetch(EBAY_OAUTH_API, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
  } catch (error) {
    console.error('[ebay] oauth token request failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text()
    console.warn('[ebay] failed to fetch oauth token', {
      status: tokenRes.status,
      statusText: tokenRes.statusText,
      errorBody: errorBody.slice(0, 800),
    })
    return null
  }

  const tokenData = await tokenRes.json() as {
    access_token?: string
    expires_in?: number
  }
  if (!tokenData.access_token || !tokenData.expires_in) {
    console.warn('[ebay] oauth response missing token fields')
    return null
  }

  tokenCache = {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + Math.max((tokenData.expires_in - 60) * 1000, 60_000),
  }
  return tokenData.access_token
}

export async function findSoldListings(query: string): Promise<EbayListing[]> {
  const normalizedQuery = normalizeQueryForBrowse(query)
  const cacheKey = normalizedQuery.toLowerCase()
  const cached = soldListingsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    console.info('[ebay] cache hit for sold listings', {
      query,
      normalizedQuery,
      listingCount: cached.listings.length,
    })
    return cached.listings
  }

  const accessToken = await getEbayAccessToken()
  if (!accessToken) {
    console.warn('[ebay] missing oauth token; returning no results', { query, normalizedQuery })
    return []
  }

  const queryVariants = buildFallbackQueries(normalizedQuery)

  try {
    for (const variant of queryVariants) {
      const params = new URLSearchParams({
        q: variant,
        limit: '20',
        sort: 'endingSoonest',
      })
      const requestUrl = `${EBAY_BROWSE_API}?${params}`
      console.info('[ebay] searching listings', {
        query,
        normalizedQuery,
        variant,
        marketplaceId: EBAY_MARKETPLACE_ID,
        params: {
          q: variant,
          limit: '20',
          sort: 'endingSoonest',
        },
      })
      const res = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID,
        },
      })
      if (!res.ok) {
        let errorBody = ''
        try {
          errorBody = await res.text()
        } catch {
          errorBody = ''
        }
        console.warn('[ebay] non-200 response from Browse API', {
          query,
          normalizedQuery,
          variant,
          status: res.status,
          statusText: res.statusText,
          errorBody: errorBody.slice(0, 800),
        })
        return []
      }

      const data = await res.json() as {
        total?: number
        itemSummaries?: Array<{
          title?: string
          price?: { value?: string }
          itemEndDate?: string
          condition?: string
          itemWebUrl?: string
          image?: { imageUrl?: string }
          thumbnailImages?: Array<{ imageUrl?: string }>
        }>
      }
      const itemSummaries = data.itemSummaries
      const itemLength = Array.isArray(itemSummaries) ? itemSummaries.length : 0

      console.info('[ebay] response summary', {
        query,
        normalizedQuery,
        variant,
        total: data.total ?? 0,
        itemArray: Array.isArray(itemSummaries),
        itemLength,
      })
      if (!Array.isArray(itemSummaries) || itemLength === 0) continue

      const listings = itemSummaries.map((item): EbayListing => ({
        title: item.title ?? '',
        price_usd: parseFloat(item.price?.value ?? '0'),
        sold_date: item.itemEndDate ?? '',
        condition: item.condition ?? '',
        url: item.itemWebUrl ?? '',
        thumbnail: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl ?? '',
      }))
      console.info('[ebay] mapped listings', {
        query,
        normalizedQuery,
        variant,
        listingCount: listings.length,
        firstTitle: listings[0]?.title ?? null,
      })
      soldListingsCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        listings,
      })
      return listings
    }

    console.warn('[ebay] no listings found for any query variant', {
      query,
      normalizedQuery,
      queryVariants,
    })
    return []
  } catch (error) {
    console.error('[ebay] exception while searching sold listings', {
      query,
      normalizedQuery,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
