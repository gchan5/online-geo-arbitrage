'use client'

import { useState } from 'react'
import { UrlInput } from '@/components/UrlInput'
import { MercariPanel } from '@/components/MercariPanel'
import { EbayPanel } from '@/components/EbayPanel'
import { ArbitrageBar } from '@/components/ArbitrageBar'
import type { AnalyzeChunk, MercariListing, EbayListing } from '@/lib/types'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function Home() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [mercari, setMercari] = useState<MercariListing | null>(null)
  const [titleEn, setTitleEn] = useState('')
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [listings, setListings] = useState<EbayListing[] | null>(null)

  async function handleSubmit(url: string) {
    setStatus('loading')
    setError(null)
    setMercari(null)
    setTitleEn('')
    setUsdRate(null)
    setListings(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          const chunk = JSON.parse(line) as AnalyzeChunk

          if (chunk.type === 'mercari') {
            setMercari(chunk.data)
          } else if (chunk.type === 'meta') {
            setTitleEn(chunk.data.title_en)
            setUsdRate(chunk.data.usd_rate)
          } else if (chunk.type === 'ebay') {
            setListings(chunk.data.listings)
            setStatus('done')
          } else if (chunk.type === 'error') {
            setError(chunk.message)
            setStatus('error')
          }
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  async function handleReSearch(query: string) {
    setTitleEn(query)
    setListings(null)
    setStatus('loading')

    try {
      const res = await fetch('/api/ebay-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json() as { listings: EbayListing[] }
      setListings(data.listings)
      setStatus('done')
    } catch {
      setStatus('done') // don't wipe existing results on re-search failure
    }
  }

  const loading = status === 'loading'

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-6">
        Mercari Compare
      </h1>

      <UrlInput onSubmit={handleSubmit} loading={loading} />

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-6 text-sm text-red-300">
          {error}
        </div>
      )}

      {(loading || mercari) && (
        <>
          <div className="flex gap-4 mb-4">
            <MercariPanel
              listing={mercari}
              titleEn={titleEn}
              usdRate={usdRate}
              loading={loading}
              onEditTitle={(next) => {
                setTitleEn(next)
                handleReSearch(next)
              }}
            />
            <EbayPanel
              listings={listings}
              searchQuery={titleEn}
              loading={loading}
              onReSearch={handleReSearch}
            />
          </div>

          {mercari && usdRate && listings && listings.length > 0 && (
            <ArbitrageBar
              mercariPriceJpy={mercari.price_jpy}
              usdRate={usdRate}
              listings={listings}
            />
          )}
        </>
      )}
    </main>
  )
}
