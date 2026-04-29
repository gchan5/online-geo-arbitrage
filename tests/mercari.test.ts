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

function makeMetaHtml({
  title = 'ビジョット 073/pcg-p 未開封',
  price = '5200',
  image = 'https://static.mercdn.net/item/detail/orig/photos/m58789949313_1.jpg?1777130351',
}: {
  title?: string
  price?: string
  image?: string
}) {
  return `<html><head>
    <meta property="og:title" content="${title} by メルカリ" />
    <meta property="product:price:amount" content="${price}" />
    <meta property="og:image" content="${image}" />
  </head><body></body></html>`
}

function makeBuyeeHtml({
  title = 'わるいゲンガー LV.32 ★ [旧裏面] /【Buyee】 Buyee - Japanese Proxy Service',
  image = 'https://buyee.jp/images/sample.jpg',
  currentPrice = '31,819',
  condition = 'Damaged/dirty',
  shipping = 'Winner',
}: {
  title?: string
  image?: string
  currentPrice?: string
  condition?: string
  shipping?: 'Winner' | 'Seller'
}) {
  return `<html><head>
    <meta property="og:title" content="${title}" />
    <meta property="og:image" content="${image}" />
  </head><body>
    <div>Item Condition ${condition}</div>
    <div>Current Price ${currentPrice} YEN</div>
    <div>Domestic Shipping Fee Responsibility ${shipping}</div>
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
      expect(result.error).toMatch(/mercari|buyee|invalid/i)
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

  it('returns listing for valid Buyee JDirectItems auction page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => makeBuyeeHtml({}),
    }))

    const result = await fetchMercariListing('https://buyee.jp/item/jdirectitems/auction/b1225803330')
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.title_jp).toBe('わるいゲンガー LV.32 ★ [旧裏面]')
      expect(result.price_jpy).toBe(31819)
      expect(result.condition).toBe('Damaged/dirty')
      expect(result.shipping_included).toBe(false)
      expect(result.images[0]).toContain('buyee.jp/images/sample.jpg')
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

  it('falls back to meta tags when __NEXT_DATA__ is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => makeMetaHtml({}),
    }))

    const result = await fetchMercariListing('https://jp.mercari.com/item/m58789949313')
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.title_jp).toBe('ビジョット 073/pcg-p 未開封')
      expect(result.price_jpy).toBe(5200)
      expect(result.images[0]).toContain('m58789949313_1.jpg')
    }
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
