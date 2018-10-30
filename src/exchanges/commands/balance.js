const logger = require('../../common/logger').logger;
const util = require('../../common/util');
const notifier = require('../../notifications/notifier');


/**
 * Report account details (Generic version)
 */
module.exports = async (context) => {
    const { ex = {}, symbol = '' } = context;
    logger.progress('NOTIFY ACCOUNT BALANCE');

    const balances = await ex.support.accountBalances(context);
    const orderbook = await ex.support.ticker(context);

    const assets = ex.splitSymbol(symbol);
    const price = parseFloat(orderbook.last_price);

    const totalFiat = util.roundDown(ex.balanceTotalFiat(symbol, balances, price), 2);
    const totalCoins = util.roundDown(ex.balanceTotalAsset(symbol, balances, price), 4);
    const balanceCoins = util.roundDown(balances.reduce((t, item) => (t + (item.currency === assets.asset ? parseFloat(item.amount) : 0)), 0), 4);
    const balanceFiat = util.roundDown(balances.reduce((t, item) => (t + (item.currency === assets.currency ? parseFloat(item.amount) : 0)), 0), 2);

    const msg = `${ex.name}: Balances - ${balanceCoins} ${assets.asset} & ${balanceFiat} ${assets.currency}. ` +
        `Total Value - ${totalCoins} ${assets.asset} (${totalFiat} ${assets.currency}).`;
    notifier.send(msg);
    logger.results(msg);

    return msg;
};
