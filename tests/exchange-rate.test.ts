import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchExchangeRate, FALLBACK_RATE } from '@/lib/exchange-rate'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchExchangeRate', () => {
  it('returns JPY to USD rate from Frankfurter API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { USD: 0.00672 } }),
    }))

    const rate = await fetchExchangeRate()
    expect(rate).toBe(0.00672)
  })

  it('calls the correct Frankfurter endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { USD: 0.00672 } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchExchangeRate()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.frankfurter.app/latest?from=JPY&to=USD'
    )
  })

  it('returns FALLBACK_RATE when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const rate = await fetchExchangeRate()
    expect(rate).toBe(FALLBACK_RATE)
  })

  it('returns FALLBACK_RATE when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }))
    const rate = await fetchExchangeRate()
    expect(rate).toBe(FALLBACK_RATE)
  })

  it('FALLBACK_RATE is a reasonable JPY/USD rate', () => {
    expect(FALLBACK_RATE).toBeGreaterThan(0.005)
    expect(FALLBACK_RATE).toBeLessThan(0.015)
  })
})
