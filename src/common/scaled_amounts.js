
/**
 *
 * @param orderCount
 * @param totalSpend
 * @param randomDiff
 * @returns {number[]}
 */
function scaledAmounts(orderCount, totalSpend, randomDiff = 0) {
    // No orders, no results
    if (orderCount < 1) {
        return [];
    }

    // Create an array with a value of 1 for each order
    const sizes = Array(...Array(orderCount)).map(() => 1);

    // Add or remove a random amount from each entry in line with the scaling
    const safeDiff = randomDiff > 1 ? 1 : (randomDiff < 0 ? 0 : randomDiff);
    const randomised = sizes.map(entry => entry + ((Math.random() * safeDiff * 2) - safeDiff));

    // scale the values so they add up to the totalSpend
    const unscaledTotal = randomised.reduce((t, orderSize) => t + orderSize, 0);
    const scaleFactor = totalSpend / unscaledTotal;

    return randomised.map(entry => entry * scaleFactor);
}


module.exports = scaledAmounts;
