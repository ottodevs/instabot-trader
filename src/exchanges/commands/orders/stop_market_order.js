const logger = require('../../../common/logger').logger;


/**
 * Place a stop order
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
        trigger: 'mark',
    }, args);

    // show a little progress
    logger.progress(`STOP MARKET ORDER - ${ex.name}`);
    logger.progress(params);

    // make sure trigger is a supported value
    if (params.trigger !== 'mark' && params.trigger !== 'index' && params.trigger !== 'last') {
        logger.error(`Stop Market Order trigger of ${params.trigger} not supported. Defaulting to mark price`);
        params.trigger = 'mark';
    }

    // Validate the side
    if ((params.side !== 'buy') && (params.side !== 'sell')) {
        throw new Error('side must be buy or sell');
    }

    // Figure out the amount to trade
    const modifiedPosition = await ex.positionToAmount(symbol, params.position, params.side, params.amount);
    if (modifiedPosition.amount.value === 0) {
        logger.results('Stop market order not placed, as order size is Zero.');
        throw new Error('No funds available or order size is 0');
    }

    // Capture the modified size and direction information
    const side = modifiedPosition.side;
    const amountStr = `${modifiedPosition.amount.value}${modifiedPosition.amount.units}`;

    const orderPrice = await ex.offsetToAbsolutePrice(symbol, side === 'buy' ? 'sell' : 'buy', params.offset);
    const details = await ex.orderSizeFromAmount(symbol, side, orderPrice, amountStr);
    if (details.orderSize === 0) {
        throw new Error('No funds available or order size is 0');
    }

    const order = await ex.api.stopOrder(symbol, details.orderSize, orderPrice, side, params.trigger);
    ex.addToSession(session, params.tag, order);
    logger.results('Stop market order placed.');
    logger.dim(order);

    return order;
};
