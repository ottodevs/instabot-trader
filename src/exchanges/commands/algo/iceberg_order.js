const uuid = require('uuid/v4');
const logger = require('../../../common/logger').logger;
const util = require('../../../common/util');

/**
 * Place an iceberg algorithmic order
 */
module.exports = async (context, args) => {
    const { ex = {}, symbol = '', session = '' } = context;
    const p = ex.assignParams({
        side: 'buy',
        totalAmount: '0',
        averageAmount: '0',
        variance: '0.1%',
        limitPrice: '',
        timeLimit: '1d',
        tag: 'iceberg',
    }, args);

    // Get the params in units we can use (numbers!)
    p.totalAmount = parseFloat(p.totalAmount);
    p.averageAmount = parseFloat(p.averageAmount);
    p.limitPrice = parseFloat(p.limitPrice);
    p.timeLimit = ex.timeToSeconds(p.timeLimit, 0);

    const id = uuid();
    const varianceUnits = ex.parseQuantity(p.variance);
    const variance = varianceUnits.units === '%' ? varianceUnits.value / 100.0 : varianceUnits.value;
    const isBuy = (p.side.toLowerCase() === 'buy');
    const expiryTime = Date.now() + (p.timeLimit * 1000);

    // show a little progress
    logger.progress(`ICEBERG ORDER - ${ex.name}`);
    logger.progress(p);

    // bail out if there is basically nothing to do
    if ((p.limitPrice === 0) || (p.totalAmount === 0) || (p.averageAmount === 0)) {
        return;
    }

    // Log the algo order, so it can be cancelled
    ex.startAlgoOrder(id, p.side, session, p.tag);

    // Start off we no active order and the full amount still to fill
    let activeOrder = null;
    let amountLeft = p.totalAmount;
    let stopPrice = 0;
    let waitTime = ex.minPollingDelay;
    let isSuspended = false;

    // The loop until there is nothing left to order
    while (amountLeft > ex.minOrderSize) {
        // have we reached the expiry time of the order
        if ((ex.isAlgoOrderCancelled(id)) || (p.timeLimit > 0 && expiryTime < Date.now())) {
            logger.progress('Iceberg order over expiry time or cancelled - stopping');
            if (activeOrder) {
                await ex.api.cancelOrders([activeOrder]);
            }

            return;
        }

        // get the current price
        const orderBook = await ex.support.ticker(context);
        const currentPrice = isBuy ? parseFloat(orderBook.bid) : parseFloat(orderBook.ask);
        const isUnderLimitPrice = isBuy ? currentPrice < p.limitPrice : currentPrice > p.limitPrice;

        if (activeOrder === null) {
            // are we the right side of the limit price?
            if (isUnderLimitPrice) {
                // Figure out how big the order should be (90% to 110% of average amount)
                let amount = p.averageAmount * util.randomRange(0.9, 1.1);
                if (amount > amountLeft) amount = amountLeft;

                // figure out some prices for the order
                const offset = currentPrice - (currentPrice * (1 - variance));
                const orderPrice = isBuy ? currentPrice - offset : currentPrice + offset;
                stopPrice = isBuy ? currentPrice + offset : currentPrice - offset;
                logger.info(`${amountLeft} of Iceberg Order still to fill`);
                logger.info(`Placing order for ${amount}. cancelling at ${stopPrice}`);

                // place a new limit order
                const orderParams = [
                    { name: 'side', value: p.side, index: 0 },
                    { name: 'amount', value: `${amount}`, index: 1 },
                    { name: 'offset', value: `@${orderPrice}`, index: 2 },
                ];
                activeOrder = await ex.executeCommand(symbol, 'limitOrder', orderParams, session);
                waitTime = ex.minPollingDelay;
                isSuspended = false;
            } else {
                if (!isSuspended) {
                    logger.progress(`Iceberg order suspended while price (${currentPrice}) wrong side of limitPrice (${p.limitPrice}) - waiting`);
                }
                isSuspended = true;
            }
        } else {
            // There is already an open order, so see if it's filled yet
            const orderInfo = await ex.api.order(activeOrder);
            if (orderInfo.is_filled) {
                logger.progress('Iceberg order: filled');
                amountLeft -= orderInfo.executed;
                activeOrder = null;
                waitTime = ex.minPollingDelay;
            } else if (!orderInfo.is_open) {
                logger.progress('Iceberg order: cancelled - aborting entire order');
                return;
            } else {
                // If we slipped too far, cancel the order (we'll place a fresh one in a moment)
                const hasSlipped = isBuy ? currentPrice > stopPrice : currentPrice < stopPrice;
                if (hasSlipped) {
                    logger.progress('Iceberg order: price slipped too far - cancelling current order');
                    await ex.api.cancelOrders([activeOrder]);
                    amountLeft -= orderInfo.executed;
                    activeOrder = null;
                    waitTime = ex.minPollingDelay;
                }
            }
        }

        // wait for a bit before deciding what to do next
        await ex.waitSeconds(waitTime);
        if (waitTime < ex.maxPollingDelay) waitTime += 1;
    }

    ex.endAlgoOrder(id);
};

