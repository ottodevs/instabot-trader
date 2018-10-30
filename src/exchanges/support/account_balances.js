const logger = require('../../common/logger').logger;


/**
 * Get the balances on the account (related to the symbol)
 */
module.exports = async (context) => {
    const { ex = {}, symbol = '' } = context;

    // Fetch the actual wallet balance
    const wallet = await ex.api.walletBalances();

    // Filter it to just the symbol we are working with
    const assets = ex.splitSymbol(symbol);
    const filtered = wallet.filter(item => item.type === 'exchange' && (item.currency === assets.asset || item.currency === assets.currency));
    logger.debug(filtered);

    return filtered;
};
