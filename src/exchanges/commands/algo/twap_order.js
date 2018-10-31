const uuid = require('uuid/v4');
const timesSeries = require('async').timesSeries;
const logger = require('../../../common/logger').logger;
const util = require('../../../common/util');
const scaledAmounts = require('../../../common/scaled_amounts');

/**
 * Place a series of market orders at intervals
 * Time Weighted Average Price
 */
module.exports = async (context, args) => {
    const { ex = {}, symbol = '', session = '' } = context;

    const p = ex.assignParams({
        side: 'buy',
        amount: '0',
        orderCount: '10',
        duration: '60s',
        position: '',
        varyAmount: '0',
        tag: 'twap',
    }, args);

    // show a little progress
    logger.progress(`STEPPED MARKET ORDER - ${ex.name}`);
    logger.progress(p);

    // get the values as numbers (clamped into range)
    p.orderCount = Math.max(Math.min(parseInt(p.orderCount, 10), 100), 2);
    p.varyAmount = ex.parsePercentage(p.varyAmount);
    if (p.duration < 1) p.duration = 1;

    // Work out how long to wait between each order (in ms)
    const timeGap = util.roundUp((ex.timeToSeconds(p.duration, 60) / p.orderCount), 0);

    // Figure out the size of each order
    const modifiedPosition = await ex.positionToAmount(symbol, p.position, p.side, p.amount);
    if (p.amount.value === 0) {
        logger.results('stepped market order not placed, as order size is Zero.');
        return Promise.resolve({});
    }

    // Capture the modified size and direction information
    p.side = modifiedPosition.side;
    p.amount = modifiedPosition.amount;

    // figure out how big each order needs to be
    const precision = 6;
    const amounts = scaledAmounts(p.orderCount, p.amount.value, p.varyAmount, precision);

    // Log the algo order, so it can be cancelled
    const id = uuid();
    ex.startAlgoOrder(id, p.side, session, p.tag);

    // map the amount to a scaled amount (amount / steps, but keep units (eg %))
    return new Promise((resolve, reject) => {
        timesSeries(p.orderCount, async (i) => {
            if (ex.isAlgoOrderCancelled(id)) {
                throw new Error('TWAP order cancelled - aborting');
            }

            // Work out the settings to place a limit order
            const marketOrderArgs = [
                { name: 'side', value: p.side, index: 0 },
                { name: 'amount', value: `${amounts[i]}${p.amount.units}`, index: 1 },
            ];

            // Place the order
            try {
                await ex.executeCommand(symbol, 'marketOrder', marketOrderArgs, session);
            } catch (err) {
                logger.error(`Error placing a market order as part of a stepped order- ${err}`);
                logger.error('Continuing to try and place the rest of the series...');
            }

            // wait for a bit (unless this was the last order)
            if (i < p.orderCount - 1) {
                await ex.waitSeconds(timeGap);
            }
        }, err => (err ? reject(err) : resolve({})));
    });
};
