import type { FeeInputs, FeeResult } from './types'

export type { FeeInputs, FeeResult }

export const DEFAULT_FEE_INPUTS = {
  buyeeServiceFeeJpy: 300,
  buyeeDomesticShipJpy: 500,
  intlShippingUsd: 10.00,
  ebayDomesticShipUsd: 4.50,
  ebayFvfPct: 13.25,
  ebayPerOrderFee: 0.30,
} as const

export function calculateFees(inputs: FeeInputs, salePrices: number[]): FeeResult {
  const {
    mercariPriceJpy, usdRate, buyeeServiceFeeJpy, buyeeDomesticShipJpy,
    intlShippingUsd, ebayDomesticShipUsd, ebayFvfPct, ebayPerOrderFee,
  } = inputs

  const fvf = ebayFvfPct / 100
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  const totalCostUsd =
    (mercariPriceJpy + buyeeServiceFeeJpy + buyeeDomesticShipJpy) * usdRate + intlShippingUsd
  const totalCostFreeShip = totalCostUsd + ebayDomesticShipUsd
  const totalCostBuyerShip = totalCostUsd

  const avgSalePrice = avg(salePrices)
  const sorted = [...salePrices].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const medianSalePrice =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const highSalePrice = Math.max(...salePrices)
  const lowSalePrice = Math.min(...salePrices)

  // Free shipping: FVF charged on sale price only
  const ebayDeductionFreeShip = avgSalePrice * fvf + ebayPerOrderFee
  const netRevenueFreeShip = avgSalePrice - ebayDeductionFreeShip
  const profitFreeShip = netRevenueFreeShip - totalCostFreeShip

  // Buyer pays shipping: eBay charges FVF on sale price + shipping amount
  const ebayDeductionBuyerShip = (avgSalePrice + ebayDomesticShipUsd) * fvf + ebayPerOrderFee
  const netRevenueBuyerShip = avgSalePrice - ebayDeductionBuyerShip
  const profitBuyerShip = netRevenueBuyerShip - totalCostBuyerShip

  // Break-even (free ship): derived from netRevenue - totalCostFreeShip = 0
  // sale * (1 - fvf) - perOrder - totalCostFreeShip = 0
  const breakEvenFreeShip = (totalCostFreeShip + ebayPerOrderFee) / (1 - fvf)

  return {
    totalCostUsd,
    totalCostFreeShip,
    totalCostBuyerShip,
    ebayDeductionFreeShip,
    ebayDeductionBuyerShip,
    netRevenueFreeShip,
    netRevenueBuyerShip,
    profitFreeShip,
    profitBuyerShip,
    avgSalePrice,
    medianSalePrice,
    highSalePrice,
    lowSalePrice,
    breakEvenFreeShip,
  }
}
