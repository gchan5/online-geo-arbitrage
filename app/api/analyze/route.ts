import { fetchMercariListing } from '@/lib/mercari'
import { translateToEnglish } from '@/lib/translate'
import { fetchExchangeRate } from '@/lib/exchange-rate'
import { findSoldListings } from '@/lib/ebay'
import type { AnalyzeChunk } from '@/lib/types'

export async function POST(request: Request) {
  const { url } = await request.json() as { url: string }

  const encoder = new TextEncoder()
  const send = (chunk: AnalyzeChunk) =>
    encoder.encode(JSON.stringify(chunk) + '\n')

  const stream = new ReadableStream({
    async start(controller) {
      let currentStep: 'mercari' | 'translate' | 'ebay' = 'mercari'
      try {
        // Step 1: Scrape Mercari JP
        const mercariResult = await fetchMercariListing(url)
        if ('error' in mercariResult) {
          controller.enqueue(send({ type: 'error', message: mercariResult.error, step: 'mercari' }))
          return  // finally block closes the stream
        }
        controller.enqueue(send({ type: 'mercari', data: mercariResult }))

        // Step 2: Translate + exchange rate in parallel
        currentStep = 'translate'
        const [translateResult, usdRate] = await Promise.all([
          translateToEnglish(mercariResult.title_jp),
          fetchExchangeRate(),
        ])
        controller.enqueue(send({
          type: 'meta',
          data: { title_en: translateResult.text, usd_rate: usdRate },
        }))

        // Step 3: eBay sold listings
        currentStep = 'ebay'
        console.info('[api/analyze] searching ebay from translated title', {
          title_en: translateResult.text,
        })
        const listings = await findSoldListings(translateResult.text)
        console.info('[api/analyze] ebay search complete', {
          title_en: translateResult.text,
          total_results: listings.length,
        })
        controller.enqueue(send({
          type: 'ebay',
          data: { listings, total_results: listings.length },
        }))

      } catch (err) {
        controller.enqueue(send({
          type: 'error',
          message: 'An unexpected error occurred.',
          step: currentStep,
        }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
