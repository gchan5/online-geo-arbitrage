'use client'

import { useState } from 'react'
import { calculateFees, DEFAULT_FEE_INPUTS } from '@/lib/fees'
import type { EbayListing, FeeInputs } from '@/lib/types'

interface ArbitrageBarProps {
  mercariPriceJpy: number
  usdRate: number
  listings: EbayListing[]
}

export function ArbitrageBar({ mercariPriceJpy, usdRate, listings }: ArbitrageBarProps) {
  const [feeInputs, setFeeInputs] = useState<Omit<FeeInputs, 'mercariPriceJpy' | 'usdRate'>>({
    buyeeServiceFeeJpy: DEFAULT_FEE_INPUTS.buyeeServiceFeeJpy,
    buyeeDomesticShipJpy: DEFAULT_FEE_INPUTS.buyeeDomesticShipJpy,
    intlShippingUsd: DEFAULT_FEE_INPUTS.intlShippingUsd,
    ebayDomesticShipUsd: DEFAULT_FEE_INPUTS.ebayDomesticShipUsd,
    ebayFvfPct: DEFAULT_FEE_INPUTS.ebayFvfPct,
    ebayPerOrderFee: DEFAULT_FEE_INPUTS.ebayPerOrderFee,
  })

  const salePrices = listings.map(l => l.price_usd).filter(p => p > 0)
  if (salePrices.length === 0) return null

  const fees = calculateFees(
    { mercariPriceJpy, usdRate, ...feeInputs },
    salePrices
  )

  function update(key: keyof typeof feeInputs, raw: string) {
    const val = parseFloat(raw)
    if (!isNaN(val) && val >= 0) {
      setFeeInputs(prev => ({ ...prev, [key]: val }))
    }
  }

  const bestProfit = calculateFees({ mercariPriceJpy, usdRate, ...feeInputs }, [fees.highSalePrice]).profitFreeShip
  const worstProfit = calculateFees({ mercariPriceJpy, usdRate, ...feeInputs }, [fees.lowSalePrice]).profitFreeShip

  const profitColor = (n: number) =>
    n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-zinc-400'

  const fmt = (n: number) =>
    `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`

  return (
    <div className="bg-emerald-950 border border-emerald-900 rounded-xl p-5">

      {/* Headline */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <p className="text-xs text-emerald-300 uppercase tracking-widest mb-1">
            Net Profit After Fees
          </p>
          <p className={`text-3xl font-extrabold leading-none ${profitColor(fees.profitFreeShip)}`}>
            {fmt(fees.profitFreeShip)}{' '}
            <span className="text-lg text-emerald-400">
              {fees.avgSalePrice > 0
                ? `${((fees.profitFreeShip / fees.avgSalePrice) * 100).toFixed(0)}%`
                : ''}
            </span>
          </p>
          <p className="text-xs text-emerald-400 mt-1">
            Based on eBay avg sold price of ${fees.avgSalePrice.toFixed(2)} · free shipping
          </p>
        </div>

        <div className="flex gap-5">
          <Stat label="Best Case" value={fmt(bestProfit)} profit={bestProfit} />
          <Stat label="Avg" value={fmt(fees.profitFreeShip)} profit={fees.profitFreeShip} />
          <div className="text-center">
            <p className="text-xs text-emerald-300 uppercase tracking-widest mb-1">Break-Even</p>
            <p className="text-sm font-semibold text-amber-400">${fees.breakEvenFreeShip.toFixed(2)}</p>
          </div>
          <Stat label="Worst Case" value={fmt(worstProfit)} profit={worstProfit} />
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="flex flex-wrap gap-6 border-t border-emerald-900 pt-4">

        {/* Costs */}
        <div className="flex-1 min-w-48">
          <p className="text-xs text-emerald-300 uppercase tracking-widest mb-2">Total Cost</p>
          <FeeRow label="Mercari price" value={`¥${mercariPriceJpy.toLocaleString()} ($${(mercariPriceJpy * usdRate).toFixed(2)})`} />
          <FeeRow label="Buyee service fee" value={`¥${feeInputs.buyeeServiceFeeJpy} ($${(feeInputs.buyeeServiceFeeJpy * usdRate).toFixed(2)})`} />
          <FeeRow label="Japan domestic ship" value={`¥${feeInputs.buyeeDomesticShipJpy} ($${(feeInputs.buyeeDomesticShipJpy * usdRate).toFixed(2)})`} />
          <EditableFeeRow label="Intl. shipping (est.)" prefix="$" value={feeInputs.intlShippingUsd} onChange={v => update('intlShippingUsd', v)} />
          <EditableFeeRow label="eBay domestic ship" prefix="$" value={feeInputs.ebayDomesticShipUsd} onChange={v => update('ebayDomesticShipUsd', v)} />
          <div className="border-t border-emerald-900 mt-1.5 pt-1.5 flex justify-between">
            <span className="text-xs font-bold text-emerald-300">Total cost</span>
            <span className="text-xs font-bold text-zinc-200">${fees.totalCostFreeShip.toFixed(2)}</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="flex-1 min-w-48">
          <p className="text-xs text-emerald-300 uppercase tracking-widest mb-2">Revenue After eBay Fees</p>
          <FeeRow label="eBay avg sale price" value={`$${fees.avgSalePrice.toFixed(2)}`} />
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-zinc-400">eBay final value fee</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={feeInputs.ebayFvfPct}
                onChange={e => update('ebayFvfPct', e.target.value)}
                className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 text-center"
                step="0.01"
                min="0"
                max="100"
              />
              <span className="text-xs text-zinc-500">%</span>
            </div>
          </div>
          <FeeRow label="eBay per-order fee" value={`$${feeInputs.ebayPerOrderFee.toFixed(2)}`} />
          <FeeRow label="eBay deduction" value={`−$${fees.ebayDeductionFreeShip.toFixed(2)}`} negative />
          <div className="border-t border-emerald-900 mt-1.5 pt-1.5 flex justify-between">
            <span className="text-xs font-bold text-emerald-300">Net revenue</span>
            <span className="text-xs font-bold text-zinc-200">${fees.netRevenueFreeShip.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Shipping toggle */}
      <div className="flex flex-wrap items-center gap-3 mt-4 border-t border-emerald-900 pt-4">
        <span className="text-xs text-emerald-300 uppercase tracking-widest">eBay listing:</span>
        <span className="text-xs bg-emerald-900 border border-emerald-700 text-green-400 font-semibold rounded px-2.5 py-1">
          Free shipping
        </span>
        <span className="text-xs border border-emerald-900 text-emerald-400 rounded px-2.5 py-1">
          Buyer pays shipping
        </span>
        <div className="ml-auto flex gap-4">
          <div className="text-center">
            <p className="text-xs text-emerald-400">Free ship profit</p>
            <p className={`text-sm font-bold ${profitColor(fees.profitFreeShip)}`}>{fmt(fees.profitFreeShip)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-emerald-400">Buyer pays profit</p>
            <p className={`text-sm font-bold ${profitColor(fees.profitBuyerShip)}`}>{fmt(fees.profitBuyerShip)}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-700 border-t border-emerald-900 pt-3 mt-3">
        eBay fee defaults: {feeInputs.ebayFvfPct}% final value + ${feeInputs.ebayPerOrderFee.toFixed(2)}/order. Buyee: ¥{feeInputs.buyeeServiceFeeJpy} service + ¥{feeInputs.buyeeDomesticShipJpy} domestic. Exchange rate: ¥1 = ${usdRate.toFixed(5)}. All estimates — actual costs vary.
      </p>
    </div>
  )
}

function Stat({ label, value, profit }: { label: string; value: string; profit: number }) {
  const color = profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-zinc-400'
  return (
    <div className="text-center">
      <p className="text-xs text-emerald-300 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function FeeRow({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between mb-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-xs ${negative ? 'text-red-400' : 'text-zinc-200'}`}>{value}</span>
    </div>
  )
}

function EditableFeeRow({
  label, prefix, value, onChange,
}: {
  label: string; prefix: string; value: number; onChange: (v: string) => void
}) {
  return (
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-zinc-200">{prefix}</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 text-center"
          step="0.01"
          min="0"
        />
      </div>
    </div>
  )
}
