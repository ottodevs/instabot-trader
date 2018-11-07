const timesSeries = require('async').timesSeries;
const logger = require('../../../common/logger').logger;
const scaledAmounts = require('../../../common/scaled_amounts');
const scaledPrices = require('../../../common/scaled_prices');


/**
 * scaledOrder
 * scaledOrder(from, to, orderCount, amount, side, tag)
 * scaledOrder(from, to, orderCount, position, tag)
 */
module.exports = async (context, args) => {
    const { ex = {}, symbol = '', session = '' } = context;

    const p = ex.assignParams({
        from: '0',
        to: '50',
        orderCount: '10',
        amount: '0',
        side: 'buy',
        easing: 'linear',
        varyAmount: '0',
        varyPrice: '0',
        tag: '',
        position: '',
    }, args);

    // show a little progress
    logger.progress(`SCALED ORDER - ${ex.name}`);
    logger.progress(p);

    // get the order count as a number (clamped from 1 to 100)
    p.orderCount = Math.max(Math.min(parseInt(p.orderCount, 10), 100), 2);
    p.varyAmount = ex.parsePercentage(p.varyAmount);
    p.varyPrice = ex.parsePercentage(p.varyPrice);

    // Figure out the size of each order
    const modifiedPosition = await ex.positionToAmount(symbol, p.position, p.side, p.amount);
    if (p.amount.value === 0) {
        logger.results('Scaled order not placed, as order size is Zero.');
        return Promise.resolve([]);
    }

    // So we now know the desired position size and direction
    p.side = modifiedPosition.side;
    p.amount = modifiedPosition.amount;

    // Get from and to as absolute prices
    p.from = await ex.offsetToAbsolutePrice(symbol, p.side, p.from);
    p.to = await ex.offsetToAbsolutePrice(symbol, p.side, p.to);

    // get from and to in order
    if ((p.side === 'buy' && p.from < p.to) || (p.side === 'sell' && p.from > p.to)) {
        const tmp = p.from;
        p.from = p.to;
        p.to = tmp;
    }

    // Adjust the size to take into account available funds
    p.amount.value = await ex.support.scaledOrderSize(context, p);
    if (p.amount.value === 0) {
        logger.results('Scaled order would result in trying to place orders below min order size. Ignoring.');
        return Promise.resolve([]);
    }

    // Get an array of amounts
    const amounts = scaledAmounts(p.orderCount, p.amount.value, p.varyAmount, ex.api.precision);
    const prices = scaledPrices(p.orderCount, p.from, p.to, p.varyPrice, p.easing);

    logger.progress('Adjusted values based on Available Funds');
    logger.progress(p);

    // map the amount to a scaled amount (amount / steps, but keep units (eg %))
    return new Promise((resolve, reject) => timesSeries(p.orderCount, async (i) => {
        // Place the order
        try {
            // Work out the settings to place a limit order
            const limitOrderArgs = [
                { name: 'side', value: p.side, index: 0 },
                { name: 'offset', value: `@${prices[i]}`, index: 1 },
                { name: 'amount', value: `${amounts[i]}${p.amount.units}`, index: 2 },
                { name: 'tag', value: p.tag, index: 3 },
            ];

            return await ex.executeCommand(symbol, 'limitOrder', limitOrderArgs, session);
        } catch (err) {
            logger.error(`Error placing a limit order as part of a scaled order - ${err}`);
            logger.error('Continuing to try and place the rest of the series...');
            return {
                order: null,
                side: p.side,
                price: prices[i],
                amount: amounts[i],
                units: p.amount.units,
            };
        }
    }, (err, orders) => (err ? reject(err) : resolve(orders))));
};
