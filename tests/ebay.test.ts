import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findSoldListings, resetEbayCacheForTests } from '@/lib/ebay'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('EBAY_CLIENT_ID', 'test-client-id')
  vi.stubEnv('EBAY_CLIENT_SECRET', 'test-client-secret')
  vi.stubEnv('EBAY_MARKETPLACE_ID', 'EBAY_US')
  resetEbayCacheForTests()
})

function makeTokenResponse() {
  return {
    access_token: 'token-123',
    expires_in: 7200,
  }
}

function makeBrowseResponse(items: object[]) {
  return {
    total: items.length,
    itemSummaries: items,
  }
}

describe('findSoldListings', () => {
  it('returns parsed eBay listings', async () => {
    const sampleItem = {
      title: 'Pikachu ex SAR 180/165',
      price: { value: '42.00' },
      itemEndDate: '2025-04-08T12:00:00.000Z',
      condition: 'Brand New',
      itemWebUrl: 'https://www.ebay.com/itm/123456',
      image: { imageUrl: 'https://thumbs.ebaystatic.com/img/test.jpg' },
    }
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTokenResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeBrowseResponse([sampleItem]),
      })
    vi.stubGlobal('fetch', mockFetch)

    const listings = await findSoldListings('Pikachu ex SAR')
    expect(listings).toHaveLength(1)
    expect(listings[0].title).toBe('Pikachu ex SAR 180/165')
    expect(listings[0].price_usd).toBe(42.00)
    expect(listings[0].url).toBe('https://www.ebay.com/itm/123456')
    expect(listings[0].thumbnail).toBe('https://thumbs.ebaystatic.com/img/test.jpg')
  })

  it('calls eBay OAuth and Browse APIs with expected params', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTokenResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeBrowseResponse([]),
      })
    vi.stubGlobal('fetch', mockFetch)

    await findSoldListings('Pikachu ex SAR')

    const [oauthUrl, oauthOptions] = mockFetch.mock.calls[0]
    expect(oauthUrl).toContain('api.ebay.com/identity/v1/oauth2/token')
    expect(oauthOptions.method).toBe('POST')
    expect(oauthOptions.headers.Authorization).toContain('Basic ')

    const [browseUrl, browseOptions] = mockFetch.mock.calls[1]
    expect(browseUrl).toContain('api.ebay.com/buy/browse/v1/item_summary/search')
    expect(browseUrl).toContain('q=Pikachu+ex+SAR')
    expect(browseOptions.headers.Authorization).toBe('Bearer token-123')
    expect(browseOptions.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US')
    expect(browseUrl).not.toContain('itemEndDate')
  })

  it('sanitizes unicode symbols before browse search', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTokenResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeBrowseResponse([]),
      })
    vi.stubGlobal('fetch', mockFetch)

    await findSoldListings('Bad Booster ◆ Set of 2')

    const [browseUrl] = mockFetch.mock.calls[1]
    expect(browseUrl).toContain('q=Bad+Booster+Set+of+2')
    expect(browseUrl).not.toContain('%E2%97%86')
  })

  it('returns empty array when no items found', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTokenResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 0 }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const listings = await findSoldListings('nonexistent card xyz')
    expect(listings).toEqual([])
  })

  it('tries fallback queries when initial query returns zero items', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTokenResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 0, itemSummaries: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeBrowseResponse([{
          title: 'Bad Booster Set',
          price: { value: '10.00' },
          itemWebUrl: 'https://www.ebay.com/itm/1',
        }]),
      })
    vi.stubGlobal('fetch', mockFetch)

    const listings = await findSoldListings('Bad Booster ◆ Set of 2')
    expect(listings).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    const [secondBrowseUrl] = mockFetch.mock.calls[2]
    expect(secondBrowseUrl).toContain('q=Bad+Booster')
  })

  it('returns empty array when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const listings = await findSoldListings('test')
    expect(listings).toEqual([])
  })

  it('returns empty array when browse response is not ok', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeTokenResponse(),
      })
      .mockResolvedValueOnce({ ok: false, text: async () => 'error' })
    vi.stubGlobal('fetch', mockFetch)

    const listings = await findSoldListings('test')
    expect(listings).toEqual([])
  })
})
