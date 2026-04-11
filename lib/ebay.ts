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
