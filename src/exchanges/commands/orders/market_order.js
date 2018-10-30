const logger = require('../../../common/logger').logger;


/**
 * Place a market order
 */
module.exports = async (context, args) => {
    const { ex = {}, symbol = '' } = context;

    // map the arguments
    const params = ex.assignParams({
        side: 'buy',
        amount: '0',
        position: '',
    }, args);

    // show a little progress
    logger.progress(`MARKET ORDER - ${ex.name}`);
    logger.progress(params);

    // Validate the side
    if ((params.side !== 'buy') && (params.side !== 'sell')) {
        return Promise.reject(new Error('side must be buy or sell'));
    }

    // Convert a position to an amount to order (if needed)
    const modifiedPosition = await ex.positionToAmount(symbol, params.position, params.side, params.amount);
    if (modifiedPosition.amount.value === 0) {
        // Nothing to do
        logger.results('market order not placed, as order size is Zero.');
        return Promise.resolve({});
    }

    // Capture the modified size and direction information
    const side = modifiedPosition.side;
    const amountStr = `${modifiedPosition.amount.value}${modifiedPosition.amount.units}`;

    // convert the amount to an actual order size.
    const orderPrice = await ex.offsetToAbsolutePrice(symbol, side, '0');
    const details = await ex.orderSizeFromAmount(symbol, side, orderPrice, amountStr);
    if (details.orderSize === 0) {
        return Promise.reject('No funds available or order size is zero');
    }

    // Finally place the order
    const order = await ex.api.marketOrder(symbol, details.orderSize, side, details.isAllAvailable);
    logger.dim(order);
    return order;
};
