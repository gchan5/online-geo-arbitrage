'use client'

import Image from 'next/image'
import type { MercariListing } from '@/lib/types'

interface MercariPanelProps {
  listing: MercariListing | null
  titleEn: string
  usdRate: number | null
  loading: boolean
  onEditTitle: (title: string) => void
}

export function MercariPanel({
  listing,
  titleEn,
  usdRate,
  loading,
  onEditTitle,
}: MercariPanelProps) {
  if (loading && !listing) {
    return (
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="aspect-square max-h-64 bg-zinc-800 animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  if (!listing) return null

  const priceUsd = usdRate ? (listing.price_jpy * usdRate).toFixed(2) : null

  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Big image */}
      <div className="relative aspect-square max-h-64 bg-zinc-800">
        {listing.images[0] ? (
          <Image
            src={listing.images[0]}
            alt={listing.title_jp}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">🃏</div>
        )}
        {listing.images.length > 1 && (
          <span className="absolute top-2 right-2 bg-black/60 text-zinc-400 text-xs rounded px-1.5 py-0.5">
            1 / {listing.images.length}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Mercari JP</p>
        <p className="text-xs text-zinc-500 mb-1">{listing.title_jp}</p>

        {/* Editable English title */}
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-semibold text-blue-400 flex-1 min-w-0 truncate">
            {titleEn || listing.title_jp}
          </p>
          <button
            onClick={() => {
              const next = prompt('Edit search title:', titleEn || listing.title_jp)
              if (next !== null) onEditTitle(next)
            }}
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-500 rounded px-1.5 py-0.5 flex-shrink-0 hover:text-zinc-300 transition-colors"
          >
            edit
          </button>
        </div>

        <p className="text-xl font-bold text-green-400">
          ¥{listing.price_jpy.toLocaleString()}
        </p>
        {priceUsd && (
          <p className="text-xs text-zinc-500 mt-0.5 mb-3">≈ ${priceUsd} USD</p>
        )}

        <div className="border-t border-zinc-800 pt-3 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500">Condition</span>
            <span className="text-xs text-zinc-300">{listing.condition_en}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500">Seller rating</span>
            <span className="text-xs text-amber-400">★ {listing.seller_rating}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500">Shipping (JP)</span>
            <span className="text-xs text-zinc-300">
              {listing.shipping_included ? 'Included' : 'Buyer pays'}
            </span>
          </div>
        </div>

        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs text-blue-400 hover:underline"
        >
          ↗ View on Mercari JP
        </a>
      </div>
    </div>
  )
}
