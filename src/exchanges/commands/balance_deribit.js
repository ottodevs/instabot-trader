const logger = require('../../common/logger').logger;
const util = require('../../common/util');
const notifier = require('../../notifications/notifier');


/**
 * Report account details (Deribit edition)
 */
module.exports = (context) => {
    const { ex = {} } = context;
    logger.progress('NOTIFY ACCOUNT BALANCE');

    return ex.api.account().then((account) => {
        const msg = `Deribit: Equity: ${util.roundDown(account.equity, 4)} btc, ` +
            `available: ${util.roundDown(account.availableFunds, 4)} btc, ` +
            `balance: ${util.roundDown(account.balance, 4)} btc, pnl: ${util.roundDown(account.PNL, 4)} btc.`;
        notifier.send(msg);
        logger.results(msg);
    });
};
