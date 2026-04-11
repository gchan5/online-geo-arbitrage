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
