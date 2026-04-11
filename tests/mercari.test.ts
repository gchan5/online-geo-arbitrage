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
