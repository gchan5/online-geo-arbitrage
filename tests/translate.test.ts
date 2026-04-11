import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateToEnglish } from '@/lib/translate'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubEnv('GOOGLE_TRANSLATE_API_KEY', 'test-key')
})

describe('translateToEnglish', () => {
  it('returns translated text from Google Translate API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { translations: [{ translatedText: 'Pikachu ex SAR' }] },
      }),
    }))

    const result = await translateToEnglish('ピカチュウex SAR')
    expect(result.text).toBe('Pikachu ex SAR')
    expect(result.failed).toBe(false)
  })

  it('POSTs to the correct endpoint with the API key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { translations: [{ translatedText: 'test' }] },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await translateToEnglish('テスト')
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('translation.googleapis.com')
    expect(url).toContain('test-key')
    const body = JSON.parse(options.body)
    expect(body.q).toBe('テスト')
    expect(body.source).toBe('ja')
    expect(body.target).toBe('en')
  })

  it('returns original text with failed=true when API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const result = await translateToEnglish('ピカチュウ')
    expect(result.text).toBe('ピカチュウ')
    expect(result.failed).toBe(true)
  })

  it('returns original text with failed=true when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }))
    const result = await translateToEnglish('テスト')
    expect(result.text).toBe('テスト')
    expect(result.failed).toBe(true)
  })
})
