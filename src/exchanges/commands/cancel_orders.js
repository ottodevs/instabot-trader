const logger = require('../../common/logger').logger;

/**
 * Close some orders
 */
module.exports = async (context, args) => {
    const { ex = {}, symbol = '', session = '' } = context;

    // map the arguments
    const p = ex.assignParams({
        // buy, sell, all, session (all orders from session),
        // tagged (all with matching tag in session)
        which: 'session',

        // used when which is tagged
        tag: '',
    }, args);

    logger.progress(`CANCEL ORDERS - ${ex.name}`);
    logger.progress(p);

    // first, ask relevant algorithmic orders to cancel
    ex.cancelAlgorithmicOrders(p.which, p.tag, session);

    // go do some work
    switch (p.which) {
        case 'buy':
        case 'sell':
        case 'all':
            // get the active orders from the API
            // Filter down to just the side we want
            return ex.api.activeOrders(symbol, p.which)
                .then(orders => ex.api.cancelOrders(orders));

        case 'tagged':
            // map the result to a list of order ids
            return ex.api.cancelOrders(ex.findInSession(session, p.tag));

        default:
        case 'session':
            // map the result to a list of order ids
            return ex.api.cancelOrders(ex.findInSession(session, null));
    }
};
