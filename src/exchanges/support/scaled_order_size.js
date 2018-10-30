const util = require('../../common/util');
const EasingFunction = require('../../common/easing');


/**
 * Work out the actual order size for hte scaled order
 * taking into account the available funds and the order size and prices
 * Simple enough for buy orders, as everything is measured in assets (eg btc)
 * For selling, we have to work out equivalent values in currency (usd) and scaled to fit.
 * @param context
 * @param p - params from scaled orders
 * @returns {Promise<*>}
 */
module.exports = async (context, p) => {
    const { ex = {}, symbol = '' } = context;

    // If the units are anything other than 'asset', then just go with it
    if (p.amount.units !== '') {
        return p.amount.value;
    }

    // Things we'll need along the way
    const asset = ex.splitSymbol(symbol);
    const wallet = await ex.support.accountBalances(context);
    const desiredAmount = p.amount.value;
    const orderCount = p.orderCount;
    let assetToSpend = 0;

    // if selling (simple case, dealing with asset values), find out how much Asset is available
    if (p.side === 'sell') {
        const assetAvailable = wallet.reduce((available, item) => available + (asset.asset === item.currency ? parseFloat(item.available) : 0), 0);
        assetToSpend = (assetAvailable < desiredAmount) ? assetAvailable : desiredAmount;
    } else {
        // Not selling - Buying, so have to cross work everything out in base currency
        // build a list of all the order prices...
        const prices = [];
        for (let i = 0; i < orderCount; i++) {
            prices.push(util.round(EasingFunction(p.from, p.to, i / (orderCount - 1), p.easing), 2));
        }

        // Work out the currency equivalent for this set of orders
        const amountPerOrder = desiredAmount / orderCount;
        const currencyNeeded = prices.reduce((total, item) => total + (item * amountPerOrder), 0);

        // Figure out the funds available.
        const currencyAvailable = wallet.reduce((available, item) => available + (asset.currency === item.currency ? parseFloat(item.available) : 0), 0);

        // Adjust our order size based on this
        assetToSpend = (currencyAvailable < currencyNeeded) ?
            desiredAmount * (currencyAvailable / currencyNeeded) :
            desiredAmount;
    }

    // Would this result in trying to place orders below the min order size?
    if ((assetToSpend / orderCount) < ex.minOrderSize) {
        return 0;
    }

    // We had enough funds, so just do as they asked
    return util.roundDown(assetToSpend, 6);
};
