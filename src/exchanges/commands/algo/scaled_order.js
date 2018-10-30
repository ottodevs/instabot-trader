const timesSeries = require('async').timesSeries;
const logger = require('../../../common/logger').logger;
const util = require('../../../common/util');
const EasingFunction = require('../../../common/easing');


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
        orderCount: '20',
        amount: '0',
        side: 'buy',
        easing: 'linear',
        tag: '',
        position: '',
    }, args);

    // show a little progress
    logger.progress(`SCALED ORDER - ${ex.name}`);
    logger.progress(p);

    // get the values as numbers
    p.orderCount = parseInt(p.orderCount, 10);
    if (p.orderCount < 1) p.orderCount = 1;
    if (p.orderCount > 50) p.orderCount = 50;

    // Figure out the size of each order
    const modifiedPosition = await ex.positionToAmount(symbol, p.position, p.side, p.amount);
    if (p.amount.value === 0) {
        logger.results('Scaled order not placed, as order size is Zero.');
        return Promise.resolve({});
    }

    // So we now know the desired position size and direction
    p.side = modifiedPosition.side;
    p.amount = modifiedPosition.amount;

    // Get from and to as absolute prices
    p.from = await ex.offsetToAbsolutePrice(symbol, p.side, p.from);
    p.to = await ex.offsetToAbsolutePrice(symbol, p.side, p.to);

    // Adjust the size to take into account available funds
    p.amount.value = await ex.support.scaledOrderSize(context, p);
    if (p.amount.value === 0) {
        logger.results('Scaled order would result in trying to place orders below min order size. Ignoring.');
        return Promise.resolve({});
    }

    logger.progress('Adjusted values based on Available Funds');
    logger.progress(p);

    // figure out how big each order needs to be
    const perOrderSize = util.roundDown(p.amount.value / p.orderCount, 6);
    p.amount = `${perOrderSize}${p.amount.units}`;

    // map the amount to a scaled amount (amount / steps, but keep units (eg %))
    return new Promise((resolve, reject) => timesSeries(p.orderCount, async (i) => {
        // Work out the settings to place a limit order
        const price = util.round(EasingFunction(p.from, p.to, i / (p.orderCount - 1), p.easing), 2);
        const limitOrderArgs = [
            { name: 'side', value: p.side, index: 0 },
            { name: 'offset', value: `@${price}`, index: 1 },
            { name: 'amount', value: p.amount, index: 2 },
            { name: 'tag', value: p.tag, index: 3 },
        ];

        // Place the order
        try {
            return await ex.executeCommand(symbol, 'limitOrder', limitOrderArgs, session);
        } catch (err) {
            logger.error(`Error placing a limit order as part of a scaled order - ${err}`);
            logger.error('Continuing to try and place the rest of the series...');
            return {};
        }
    }, err => (err ? reject(err) : resolve({}))));
};
