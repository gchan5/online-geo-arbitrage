// Manual verification of key formulas

// Test case from tests:
const mercariPriceJpy = 4000;
const usdRate = 0.00668;
const buyeeServiceFeeJpy = 300;
const buyeeDomesticShipJpy = 500;
const intlShippingUsd = 10.00;
const ebayDomesticShipUsd = 4.50;
const ebayFvfPct = 13.25;
const ebayPerOrderFee = 0.30;
const salePrice = 50;

// Verify totalCostUsd
const totalCostUsd = (mercariPriceJpy + buyeeServiceFeeJpy + buyeeDomesticShipJpy) * usdRate + intlShippingUsd;
console.log("totalCostUsd:", totalCostUsd);
console.log("Expected: 42.064");

// Verify FVF calculations
const fvf = ebayFvfPct / 100;

// Free shipping: FVF on sale price only
const ebayDeductionFreeShip = salePrice * fvf + ebayPerOrderFee;
console.log("\nebayDeductionFreeShip:", ebayDeductionFreeShip);
console.log("Expected: 50 * 0.1325 + 0.30 =", 50 * 0.1325 + 0.30);

// Buyer pays: FVF on sale + shipping
const ebayDeductionBuyerShip = (salePrice + ebayDomesticShipUsd) * fvf + ebayPerOrderFee;
console.log("\nebayDeductionBuyerShip:", ebayDeductionBuyerShip);
console.log("Expected: 54.50 * 0.1325 + 0.30 =", 54.50 * 0.1325 + 0.30);

// Profit calculations
const netRevenueFreeShip = salePrice - ebayDeductionFreeShip;
const profitFreeShip = netRevenueFreeShip - (totalCostUsd + ebayDomesticShipUsd);
console.log("\nprofitFreeShip:", profitFreeShip);
console.log("Expected: 50 - 7.9625 - 46.564 =", 50 - 7.9625 - 46.564);

const netRevenueBuyerShip = salePrice - ebayDeductionBuyerShip;
const profitBuyerShip = netRevenueBuyerShip - totalCostUsd;
console.log("\nprofitBuyerShip:", profitBuyerShip);
console.log("Expected: 50 - 7.924175 - 42.064 =", 50 - 7.924175 - 42.064);

// Break-even calculation
const breakEvenFreeShip = (totalCostUsd + ebayDomesticShipUsd + ebayPerOrderFee) / (1 - fvf);
console.log("\nbreakEvenFreeShip:", breakEvenFreeShip);
console.log("Formula: (totalCost + perOrderFee) / (1 - fvf)");
console.log("Verify at break-even:");
const bePrice = breakEvenFreeShip;
const beDeduction = bePrice * fvf + ebayPerOrderFee;
const beNetRevenue = bePrice - beDeduction;
const beProfit = beNetRevenue - (totalCostUsd + ebayDomesticShipUsd);
console.log("Profit at break-even price:", beProfit);
