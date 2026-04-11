import { describe, it, expect } from 'vitest'
import { calculateFees, DEFAULT_FEE_INPUTS, type FeeInputs } from '@/lib/fees'

const BASE_INPUTS: FeeInputs = {
  mercariPriceJpy: 4000,
  usdRate: 0.00668,
  buyeeServiceFeeJpy: 300,
  buyeeDomesticShipJpy: 500,
  intlShippingUsd: 10.00,
  ebayDomesticShipUsd: 4.50,
  ebayFvfPct: 13.25,
  ebayPerOrderFee: 0.30,
}

describe('calculateFees', () => {
  it('calculates totalCostUsd correctly', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const expected = (4000 + 300 + 500) * 0.00668 + 10.00
    expect(result.totalCostUsd).toBeCloseTo(expected, 4)
  })

  it('adds ebayDomesticShipUsd to cost for free shipping scenario', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    expect(result.totalCostFreeShip).toBeCloseTo(result.totalCostUsd + 4.50, 4)
  })

  it('does not add domestic shipping to buyer-pays cost', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    expect(result.totalCostBuyerShip).toBeCloseTo(result.totalCostUsd, 4)
  })

  it('calculates eBay deduction for free shipping (FVF on sale price only)', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const expected = 50 * (13.25 / 100) + 0.30
    expect(result.ebayDeductionFreeShip).toBeCloseTo(expected, 4)
  })

  it('calculates eBay deduction for buyer pays (FVF on sale + shipping)', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const expected = (50 + 4.50) * (13.25 / 100) + 0.30
    expect(result.ebayDeductionBuyerShip).toBeCloseTo(expected, 4)
  })

  it('calculates profitFreeShip correctly', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const ebayDeduction = 50 * (13.25 / 100) + 0.30
    const netRevenue = 50 - ebayDeduction
    const totalCostFreeShip = (4000 + 300 + 500) * 0.00668 + 10.00 + 4.50
    expect(result.profitFreeShip).toBeCloseTo(netRevenue - totalCostFreeShip, 4)
  })

  it('calculates profitBuyerShip correctly', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const ebayDeduction = (50 + 4.50) * (13.25 / 100) + 0.30
    const netRevenue = 50 - ebayDeduction
    const totalCostBuyerShip = (4000 + 300 + 500) * 0.00668 + 10.00
    expect(result.profitBuyerShip).toBeCloseTo(netRevenue - totalCostBuyerShip, 4)
  })

  it('calculates stats correctly for multiple prices', () => {
    const result = calculateFees(BASE_INPUTS, [30, 40, 50, 60])
    expect(result.avgSalePrice).toBeCloseTo(45, 4)
    expect(result.medianSalePrice).toBeCloseTo(45, 4)
    expect(result.highSalePrice).toBe(60)
    expect(result.lowSalePrice).toBe(30)
  })

  it('calculates median correctly for odd number of prices', () => {
    const result = calculateFees(BASE_INPUTS, [10, 20, 90])
    expect(result.medianSalePrice).toBe(20)
  })

  it('calculates break-even: profit is ~0 when selling at break-even price', () => {
    const result = calculateFees(BASE_INPUTS, [50])
    const breakEvenCheck = calculateFees(BASE_INPUTS, [result.breakEvenFreeShip])
    expect(breakEvenCheck.profitFreeShip).toBeCloseTo(0, 1)
  })

  it('DEFAULT_FEE_INPUTS contains expected values', () => {
    expect(DEFAULT_FEE_INPUTS.buyeeServiceFeeJpy).toBe(300)
    expect(DEFAULT_FEE_INPUTS.buyeeDomesticShipJpy).toBe(500)
    expect(DEFAULT_FEE_INPUTS.intlShippingUsd).toBe(10.00)
    expect(DEFAULT_FEE_INPUTS.ebayDomesticShipUsd).toBe(4.50)
    expect(DEFAULT_FEE_INPUTS.ebayFvfPct).toBe(13.25)
    expect(DEFAULT_FEE_INPUTS.ebayPerOrderFee).toBe(0.30)
  })
})
