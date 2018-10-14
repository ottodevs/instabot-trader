const log = require('../common/logger');
const util = require('../common/util');
const Exchange = require('./exchange');
const DeribitApi = require('../apis/deribit');
const notifier = require('../notifications/notifier');

const logger = log.logger;


/**
 * Deribit version of the exchange
 */
class Deribit extends Exchange {
    /**
     * Set up the API and commands
     * @param credentials
     */
    constructor(credentials) {
        super(credentials);
        this.name = 'deribit';
        this.minOrderSize = 1;

        // Add all the commands we support
        this.addCommands(['limitOrder', 'marketOrder', 'cancelOrders']);

        // start up any sockets or create API handlers here.
        this.api = new DeribitApi(credentials.key, credentials.secret);
    }

    /**
     * Handle shutdown
     */
    terminate() {
        logger.progress('Deribit exchange closing down');
        super.terminate();
    }

    /**
     * Find the order size from the amount. This is more restricted in Deribit compared to Bitfinex.
     * @param symbol
     * @param side
     * @param orderPrice
     * @param amountStr
     * @returns {Promise<{total: *, available: *, isAllAvailable: boolean, orderSize: *}>}
     */
    orderSizeFromAmount(symbol, side, orderPrice, amountStr) {
        // Validate we are not trying to use a % of the wallet (leverage does not really have this concept)
        const amount = this.parseQuantity(amountStr);
        if (amount.units !== '') {
            return Promise.reject(new Error('Deribit amount does not support % or units. Use just the number of contracts (eg "1")'));
        }

        // And return the data in a suitable format
        return Promise.resolve({
            total: 0,
            available: 0,
            isAllAvailable: false,
            orderSize: util.roundDown(amount.value, 0),
        });
    }

    /**
     * Replace the base class implementation to handle the fact we don't really
     * have the same concept of 'available funds` on Deribit.
     * @param symbol
     * @param params - from scaled order
     * @returns {Promise<*>}
     */
    async scaledOrderSize(symbol, params) {
        // need to have at least 1 contract per order
        if (params.amount.units === '') {
            if ((params.amount.value / params.orderCount) < this.minOrderSize) {
                return 0;
            }
        }

        // Order what you like, leverage will adjust
        return params.amount.value;
    }

    /**
     * Converts a target position size to an amount to trade
     * Default behaviour here is just to use the amount. Leveraged exchanges
     * might work out the diff needed to get to the target position and use that instead.
     * @param symbol
     * @param targetPosition - positive for long positions, negative for short positions
     * @param side
     * @param amount
     * @returns {*}
     */
    positionToAmount(symbol, targetPosition, side, amount) {
        // First see if we work using a target position, or a fixed amount
        if (targetPosition === '') {
            // use the amount as an absolute change (units not support here)
            const qty = this.parseQuantity(amount);
            return Promise.resolve({ side, amount: { value: qty.value, units: '' } });
        }

        // Find current position.
        return this.api.positions().then((openPositions) => {
            // Filter the results down to just hte symbol we are using
            logger.dim(openPositions);
            const positionSize = openPositions.reduce((size, item) => ((item.instrument.toUpperCase() !== symbol.toUpperCase()) ? size : item.size), 0);
            const change = util.roundDown(parseInt(targetPosition, 10) - positionSize, 0);

            return { side: change < 0 ? 'sell' : 'buy', amount: { value: Math.abs(change), units: '' } };
        });
    }


    /**
     * Report account details
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<string>}
     */
    balance(symbol, args, session) {
        logger.progress('NOTIFY ACCOUNT BALANCE');

        return this.api.account().then((account) => {
            const msg = `Deribit: Equity: ${util.roundDown(account.equity, 4)} btc, ` +
                `available: ${util.roundDown(account.availableFunds, 4)} btc, ` +
                `balance: ${util.roundDown(account.balance, 4)} btc, pnl: ${util.roundDown(account.PNL, 4)} btc.`;
            notifier.send(msg);
            logger.results(msg);
        });
    }
}

module.exports = Deribit;
