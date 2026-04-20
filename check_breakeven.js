// Verify break-even formula is correct
// The code uses: breakEvenFreeShip = (totalCostFreeShip + ebayPerOrderFee) / (1 - fvf)

// Standard algebra for break-even:
// profit = 0
// netRevenue - totalCost = 0
// (price - (price * fvf + perOrder)) - totalCost = 0
// price - price * fvf - perOrder - totalCost = 0
// price * (1 - fvf) = perOrder + totalCost
// price = (perOrder + totalCost) / (1 - fvf)

const totalCost = 46.564;
const perOrder = 0.30;
const fvf = 0.1325;

const breakEven = (totalCost + perOrder) / (1 - fvf);
console.log("Break-even price:", breakEven);

// Verify
const deduction = breakEven * fvf + perOrder;
const netRevenue = breakEven - deduction;
const profit = netRevenue - totalCost;
console.log("Profit at break-even:", profit);
console.log("Formula check: CORRECT" + (Math.abs(profit) < 0.01 ? " ✓" : " ✗"));
