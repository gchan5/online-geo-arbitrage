// Quick edge case tests
const calculateFees = (inputs, salePrices) => {
  const {
    mercariPriceJpy, usdRate, buyeeServiceFeeJpy, buyeeDomesticShipJpy,
    intlShippingUsd, ebayDomesticShipUsd, ebayFvfPct, ebayPerOrderFee,
  } = inputs;

  const fvf = ebayFvfPct / 100;
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgSalePrice = avg(salePrices);
  console.log("Average:", avgSalePrice);
  
  const breakEvenFreeShip = (10 + 4.50 + 0.30) / (1 - fvf);
  console.log("Break-even with fvf 13.25%:", breakEvenFreeShip);
};

const inputs = { 
  mercariPriceJpy: 4000, 
  usdRate: 0.00668,
  ebayFvfPct: 13.25,
  ebayPerOrderFee: 0.30,
  buyeeServiceFeeJpy: 300,
  buyeeDomesticShipJpy: 500,
  intlShippingUsd: 10.00,
  ebayDomesticShipUsd: 4.50,
};

console.log("=== Test 1: Empty array ===");
try {
  calculateFees(inputs, []);
} catch (e) {
  console.log("Error:", e.message);
}

console.log("\n=== Test 2: FVF = 100% (division by zero in break-even) ===");
const inputs2 = { ...inputs, ebayFvfPct: 100 };
try {
  calculateFees(inputs2, [50]);
  console.log("No error - but break-even would be Infinity");
} catch (e) {
  console.log("Error:", e.message);
}
