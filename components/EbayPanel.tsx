'use client'

import Image from 'next/image'
import type { EbayListing } from '@/lib/types'

interface EbayPanelProps {
  listings: EbayListing[] | null
  searchQuery: string
  loading: boolean
  onReSearch: (query: string) => void
}

export function EbayPanel({ listings, searchQuery, loading, onReSearch }: EbayPanelProps) {
  if (loading && !listings) {
    return (
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">eBay Sold Listings</p>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3 animate-pulse">
              <div className="w-12 h-12 bg-zinc-700 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-zinc-700 rounded w-3/4" />
                <div className="h-2.5 bg-zinc-700 rounded w-1/3" />
              </div>
              <div className="h-4 bg-zinc-700 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!listings) return null

  function handleEditSearch() {
    const next = prompt('Edit eBay search query:', searchQuery)
    if (next !== null && next.trim()) onReSearch(next.trim())
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-widest">eBay Sold Listings</p>
        <span className="text-xs text-zinc-500">{listings.length} results</span>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <p className="text-sm mb-2">No sold listings found.</p>
          <button onClick={handleEditSearch} className="text-xs text-blue-400 hover:underline">
            Try a different search term
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((listing, i) => (
            <a
              key={i}
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700
                border border-transparent hover:border-zinc-600
                rounded-lg p-2.5 transition-colors no-underline
              "
            >
              <div className="relative w-12 h-12 flex-shrink-0 bg-zinc-700 rounded-lg overflow-hidden">
                {listing.thumbnail ? (
                  <Image
                    src={listing.thumbnail}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xl">🃏</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate">{listing.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {formatDate(listing.sold_date)}{listing.condition ? ` · ${listing.condition}` : ''}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-green-400">
                  ${listing.price_usd.toFixed(2)}
                </p>
                <p className="text-xs text-zinc-600">↗</p>
              </div>
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-zinc-600 text-right">
        Searching: "{searchQuery}" ·{' '}
        <button onClick={handleEditSearch} className="text-blue-400 hover:underline">
          edit search
        </button>
      </div>
    </div>
  )
}
