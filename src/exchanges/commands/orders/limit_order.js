const logger = require('../../../common/logger').logger;


/**
 * Place a limit order
 */
module.exports = async (context, args) => {
    const { ex = {}, symbol = '', session = '' } = context;

    // map the arguments
    const params = ex.assignParams({
        side: 'buy',
        offset: '0',
        amount: '0',
        tag: new Date().toISOString(),
        position: '',
    }, args);

    // show a little progress
    logger.progress(`LIMIT ORDER - ${ex.name}`);
    logger.progress(params);

    // Validate the side
    if ((params.side !== 'buy') && (params.side !== 'sell')) {
        return Promise.reject(new Error('side must be buy or sell'));
    }

    const modifiedPosition = await ex.positionToAmount(symbol, params.position, params.side, params.amount);
    if (modifiedPosition.amount.value === 0) {
        logger.results('limit order not placed, as order size is Zero.');
        return Promise.resolve({ order: null });
    }

    // Capture the modified size and direction information
    const side = modifiedPosition.side;
    const amountStr = `${modifiedPosition.amount.value}${modifiedPosition.amount.units}`;

    // Try and place the order
    const orderPrice = await ex.offsetToAbsolutePrice(symbol, side, params.offset);
    const details = await ex.orderSizeFromAmount(symbol, side, orderPrice, amountStr);
    if (details.orderSize === 0) {
        return Promise.reject('No funds available or order size is 0');
    }

    // Place the order
    const order = await ex.api.limitOrder(symbol, details.orderSize, orderPrice, side, details.isAllAvailable);
    ex.addToSession(session, params.tag, order);
    logger.results('Limit order placed.');
    logger.dim(order);
    return {
        order,
        side,
        price: orderPrice,
        amount: details.orderSize,
        units: '',
    };
};
