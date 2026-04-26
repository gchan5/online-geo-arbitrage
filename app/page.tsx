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
  const [removedListingKeys, setRemovedListingKeys] = useState<Set<string>>(new Set())

  function listingKey(listing: EbayListing): string {
    return [listing.url, listing.title, listing.sold_date, listing.price_usd].join('|')
  }

  async function handleSubmit(url: string) {
    setStatus('loading')
    setError(null)
    setMercari(null)
    setTitleEn('')
    setUsdRate(null)
    setListings(null)
    setRemovedListingKeys(new Set())

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      function processLine(line: string) {
        if (!line.trim()) return
        const chunk = JSON.parse(line) as AnalyzeChunk
        if (chunk.type === 'mercari') {
          setMercari(chunk.data)
        } else if (chunk.type === 'meta') {
          setTitleEn(chunk.data.title_en)
          setUsdRate(chunk.data.usd_rate)
        } else if (chunk.type === 'ebay') {
          setListings(chunk.data.listings)
          setRemovedListingKeys(new Set())
          setStatus('done')
        } else if (chunk.type === 'error') {
          setError(chunk.message)
          setStatus('error')
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          buffer += decoder.decode() // flush TextDecoder internal state
          if (buffer.trim()) processLine(buffer)
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) processLine(line)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  async function handleReSearch(query: string) {
    setTitleEn(query)
    setListings(null)
    setRemovedListingKeys(new Set())
    setStatus('loading')

    try {
      const res = await fetch('/api/ebay-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json() as { listings: EbayListing[] }
      setListings(data.listings)
      setRemovedListingKeys(new Set())
      setStatus('done')
    } catch {
      setListings([])
      setStatus('done')
    }
  }

  const loading = status === 'loading'
  const visibleListings = listings
    ? listings.filter((listing) => !removedListingKeys.has(listingKey(listing)))
    : null

  function handleRemoveListing(listing: EbayListing) {
    setRemovedListingKeys((prev) => {
      const next = new Set(prev)
      next.add(listingKey(listing))
      return next
    })
  }

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
          {mercari && usdRate && visibleListings && visibleListings.length > 0 && (
            <div className="mb-4">
              <ArbitrageBar
                mercariPriceJpy={mercari.price_jpy}
                usdRate={usdRate}
                listings={visibleListings}
              />
            </div>
          )}

          <div className="flex gap-4 mb-4">
            <MercariPanel
              listing={mercari}
              titleEn={titleEn}
              usdRate={usdRate}
              loading={loading}
              onEditTitle={handleReSearch}
            />
            <EbayPanel
              listings={visibleListings}
              searchQuery={titleEn}
              loading={loading}
              onReSearch={handleReSearch}
              onRemoveListing={handleRemoveListing}
            />
          </div>
        </>
      )}
    </main>
  )
}
