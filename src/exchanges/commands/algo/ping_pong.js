const uuid = require('uuid/v4');
const logger = require('../../../common/logger').logger;
const scaledOrder = require('./scaled_order');


async function placeOppositeOrder(context, p, original) {
    // Need to place the 'pong' order on the other side of the book
    const { ex = {}, symbol = '', session = '' } = context;
    const side = original.side === 'buy' ? 'sell' : 'buy';
    const price = original.side === 'buy' ? original.price + p.pongDistance : original.price - p.pongDistance;
    const limitOrderArgs = [
        { name: 'side', value: side, index: 0 },
        { name: 'offset', value: `@${price}`, index: 1 },
        { name: 'amount', value: `${original.amount}${original.units}`, index: 2 },
        { name: 'tag', value: p.tag, index: 3 },
    ];

    return ex.executeCommand(symbol, 'limitOrder', limitOrderArgs, session);
}

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
        tag: 'pingpong',
        position: '',
        pongDistance: '20',
        endless: 'false',
    }, args);

    // show a little progress
    logger.progress(`PING PONG ORDER - ${ex.name}`);
    logger.progress(p);

    // get the pong distance as a number
    p.pongDistance = parseFloat(p.pongDistance);
    p.endless = (p.endless.toLowerCase() === 'true');

    // step one - place a scaled order...
    let waitTime = ex.minPollingDelay;
    const orders = await scaledOrder(context, args);

    // Call all these orders the pings and give them a starting age of 0 (increments each time they fill and swap sides)
    let pongs = [];
    let pings = orders
        .filter(order => order.order !== null)
        .map(order => ({ ...order, age: 0 }))
        .sort((a, b) => (a.side === 'buy' ? b.price - a.price : a.price - b.price));

    logger.progress(`Ping Pong initial orders placed - ${pings.length} orders`);
    logger.progress('Waiting for orders to fill now');

    // Log the algo order, so it can be cancelled
    const id = uuid();
    if (pings.length) ex.startAlgoOrder(id, pings[0].side, session, p.tag);

    // now we have to wait for the pings to be filled
    // (actually only need to check the first one that would be hit)
    while ((p.endless && pongs.length) || pings.length) {
        // Has the algo order been cancelled - if so, cancel all outstanding orders and stop
        if (ex.isAlgoOrderCancelled(id)) {
            logger.progress('Ping Pong order cancelled - stopping');
            waitTime = ex.minPollingDelay;
            await ex.api.cancelOrders(pings.map(order => order.order));
            await ex.api.cancelOrders(pongs.map(order => order.order));
            pings = [];
            pongs = [];
        }

        // Check the pings
        if (pings.length) {
            pings.sort((a, b) => (a.side === 'buy' ? b.price - a.price : a.price - b.price));
            const orderInfo = await ex.api.order(pings[0].order);
            if (orderInfo.is_filled) {
                logger.results('Ping Pong order: order filled');
                pongs.push(await placeOppositeOrder(context, p, pings[0]));
                pings.shift();
                waitTime = ex.minPollingDelay;
            } else if (!orderInfo.is_open) {
                logger.results('Ping Pong order: found a cancelled order - discarding');
                pings.shift();
                waitTime = ex.minPollingDelay;
            }
        }

        // and the pongs (only if this endlessly flips back and forth)
        if (p.endless && pongs.length) {
            pongs.sort((a, b) => (a.side === 'buy' ? b.price - a.price : a.price - b.price));
            const orderInfo = await ex.api.order(pongs[0].order);
            if (orderInfo.is_filled) {
                logger.results('Ping Pong order: order filled');
                pings.push(await placeOppositeOrder(context, p, pongs[0]));
                pongs.shift();
                waitTime = ex.minPollingDelay;
            } else if (!orderInfo.is_open) {
                logger.results('Ping Pong order: found a cancelled order - discarding');
                pongs.shift();
                waitTime = ex.minPollingDelay;
            }
        }

        // wait for a bit before deciding what to do next
        await ex.waitSeconds(waitTime);
        if (waitTime < ex.maxPollingDelay) waitTime += 1;
    }

    ex.endAlgoOrder(id);
    logger.progress('PingPong order Complete.');
};
