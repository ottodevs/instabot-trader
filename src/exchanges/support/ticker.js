

/**
 * Gets the current prices at the top of the order book
 */
module.exports = async (context) => {
    const { ex = {}, symbol = '' } = context;

    return await ex.api.ticker(symbol);
};
