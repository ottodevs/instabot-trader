const logger = require('../common/logger').logger;
const util = require('../common/util');

// Fetch the commands we support
const wait = require('./commands/wait');
const icebergOrder = require('./commands/algo/iceberg_order');
const scaledOrder = require('./commands/algo/scaled_order');
const twapOrder = require('./commands/algo/twap_order');
const limitOrder = require('./commands/orders/limit_order');
const marketOrder = require('./commands/orders/market_order');
const stopMarketOrder = require('./commands/orders/stop_market_order');
const cancelOrders = require('./commands/cancel_orders');
const notify = require('./commands/notify');
const balance = require('./commands/balance');

// and some support functions
const scaledOrderSize = require('./support/scaled_order_size');
const ticker = require('./support/ticker');
const accountBalances = require('./support/account_balances');


/**
 * Base Exchange class
 */
class Exchange {
    /**
     * ctor
     * @param credentials
     */
    constructor(credentials) {
        this.name = 'none';
        this.credentials = credentials;
        this.refCount = 1;

        this.minOrderSize = 0.002;
        this.minPollingDelay = 5;
        this.maxPollingDelay = 60;

        this.sessionOrders = [];
        this.algorithicOrders = [];
        this.api = null;

        this.support = {
            scaledOrderSize,
            ticker,
            accountBalances,
        };

        this.commands = {
            // Algorithmic Orders
            icebergOrder,
            scaledOrder,
            twapOrder,
            steppedMarketOrder: twapOrder, // duplicate using legacy name

            // Regular orders
            limitOrder,
            marketOrder,
            stopMarketOrder,

            // Other commands
            cancelOrders,
            notify,
            balance,
            wait,
        };

        this.commandWhiteList = [
            'scaledOrder', 'twapOrder', 'steppedMarketOrder', 'icebergOrder',
            'limitOrder', 'marketOrder', 'stopMarketOrder',
            'cancelOrders', 'wait', 'macro', 'notify', 'balance'];
    }

    /**
     * Adds a reference
     */
    addReference() {
        this.refCount += 1;
    }

    /**
     * Removes a reference
     */
    removeReference() {
        this.refCount -= 1;
        return this.refCount;
    }

    /**
     * Determine if this exchange is a match of the details given
     * @param name
     * @param credentials
     * @returns {boolean}
     */
    matches(name, credentials) {
        if (name !== this.name) return false;
        return JSON.stringify(credentials) === JSON.stringify(this.credentials);
    }

    /**
     * Called after the exchange has been created, but before it has been used.
     */
    init() {
        // nothing
    }

    /**
     * Called before the exchange is destroyed
     */
    terminate() {
        // chance for any last minute shutdown stuff
    }

    /**
     * Adds the order to the session
     * @param session
     * @param tag
     * @param order
     */
    addToSession(session, tag, order) {
        this.sessionOrders.push({
            session,
            tag,
            order,
        });
    }

    /**
     * Given a session id and tag, find everything that matches
     * @param session
     * @param tag
     * @returns {*[]}
     */
    findInSession(session, tag) {
        return this.sessionOrders
            .filter(entry => entry.session === session && (tag === null || entry.tag === tag))
            .map(entry => entry.order);
    }

    /**
     * Register an algorithmic order
     * @param id
     * @param side
     * @param session
     * @param tag
     */
    startAlgoOrder(id, side, session, tag) {
        this.algorithicOrders.push({ id, side, session, tag, cancelled: false });
    }

    /**
     * Remove an order from the list
     * @param id
     */
    endAlgoOrder(id) {
        this.algorithicOrders = this.algorithicOrders.filter(item => item.id !== id);
    }

    /**
     * Determine if an algorithmic order has been cancelled or not
     * @param id
     * @returns {boolean|*}
     */
    isAlgoOrderCancelled(id) {
        const order = this.algorithicOrders.find(item => item.id === id);
        return order.cancelled;
    }

    /**
     * Ask some of the algorithmic orders to cancel
     * @param which
     * @param tag
     * @param session
     */
    cancelAlgorithmicOrders(which, tag, session) {
        this.algorithicOrders = this.algorithicOrders.map((item) => {
            const all = which === 'all';
            const buy = which === 'buy' && item.side === which;
            const sell = which === 'sell' && item.side === which;
            const tagged = which === 'tagged' && item.tag === tag;
            const cancelSession = which === 'session' && item.session === session;

            if (all || buy || sell || tagged || cancelSession) {
                item.cancelled = true;
            }

            return item;
        });
    }

    /**
     * Converts a time string (12, 12s, 12h, 12m) to an int number of seconds
     * @param time
     * @param defValue
     * @returns {number}
     */
    timeToSeconds(time, defValue = 10) {
        const regex = /([0-9]+)(d|h|m|s)?/;
        const m = regex.exec(time);
        if (m !== null) {
            const delay = parseInt(m[1], 10);

            switch (m[2]) {
                case 'm':
                    return delay * 60;

                case 'h':
                    return delay * 60 * 60;

                case 'd':
                    return delay * 60 * 60 * 24;

                default:
                    return delay;
            }
        }

        return defValue;
    }

    /**
     * Look for valid units of quantity...
     * 12, 12btc, 12usd, 12% (% of total funds) or 12%% (% of available funds)
     * @param qty
     * @returns {*}
     */
    parseQuantity(qty) {
        const regex = /^([0-9]+(\.[0-9]+)?)\s*([a-zA-Z]+|%{1,2})?$/;
        const m = regex.exec(qty);
        if (m) {
            return { value: parseFloat(m[1]), units: m[3] === undefined ? '' : m[3] };
        }

        // Does not look like a valid quantity, so treat it as zero, as that is safest
        return { value: 0, units: '' };
    }

    /**
     * Treat a number as a number or percentage. (0.01 or 1% both return 0.01)
     * @param value
     * @returns {number}
     */
    parsePercentage(value) {
        const regex = /^([0-9]+(\.[0-9]+)?)\s*(%{1,2})?$/;
        const m = regex.exec(value);
        if (m) {
            return parseFloat(m[1]) * (m[3] === '%' ? 0.01 : 1);
        }

        // Does not look like a valid quantity, so treat it as zero, as that is safest
        return 0;
    }

    /**
     * Support for named params
     * @param expected - map of expected values, with default {name: default}
     * @param named - the input argument list
     * @returns map of the arguments { name: value }
     */
    assignParams(expected, named) {
        const result = {};
        Object.keys(expected).forEach((item, i) => {
            result[item] = named.reduce((best, p) => {
                if ((p.name.toLowerCase() === item.toLowerCase()) || (p.name === '' && p.index === i)) {
                    return p.value;
                }
                return best;
            }, expected[item]);
        });

        return result;
    }

    /**
     * Execute a command on an exchange.
     * symbol - the symbol we are trading on
     * name - name of the command to execute
     * params - an array of arguments to pass the command
     */
    executeCommand(symbol, name, params, session) {
        // Look up the command, ignoring case
        const toExecute = this.commandWhiteList.find(el => (el.toLowerCase() === name.toLowerCase()));
        if ((!toExecute) || (typeof this.commands[toExecute] !== 'function')) {
            logger.error(`Unknown command: ${name}`);
            return Promise.reject('unknown command');
        }

        // Call the function
        return this.commands[toExecute]({ ex: this, symbol, session }, params);
    }

    /**
     * Given a symbol (like BTCUSD), figure out the pair (btc & usd)
     * @param symbol
     * @returns {*}
     */
    splitSymbol(symbol) {
        const regex = /^(.{3,4})(.{3})/u;
        const m = regex.exec(symbol.toLowerCase());
        if (m) {
            return { asset: m[1], currency: m[2] };
        }

        // Default to btc / usd - not sure about this...
        // should really just throw an error
        return { asset: 'btc', currency: 'usd' };
    }

    /**
     * Works out the current value of the portfolio by looking
     * at the amount of BTC and USD, and using the current price
     * Returns the value, in BTC
     * @param symbol
     * @param balances
     * @param price
     */
    balanceTotalAsset(symbol, balances, price) {
        // Work out the total value of the portfolio
        const asset = this.splitSymbol(symbol);
        const total = balances.reduce((t, item) => {
            if (item.currency === asset.currency) {
                return t + (parseFloat(item.amount) / price);
            } else if (item.currency === asset.asset) {
                return t + parseFloat(item.amount);
            }

            return t;
        }, 0);

        const roundedTotal = util.roundDown(total, 4);
        logger.results(`Total @ ${price}: ${roundedTotal} ${asset.asset}`);
        return roundedTotal;
    }

    /**
     * Get the balance total in the fiat currency
     * @param symbol
     * @param balances
     * @param price
     * @returns {*}
     */
    balanceTotalFiat(symbol, balances, price) {
        // Work out the total value of the portfolio
        const asset = this.splitSymbol(symbol);
        const total = balances.reduce((t, item) => {
            if (item.currency === asset.currency) {
                return t + parseFloat(item.amount);
            } else if (item.currency === asset.asset) {
                return t + (parseFloat(item.amount) * price);
            }

            return t;
        }, 0);

        const roundedTotal = util.roundDown(total, 4);
        logger.results(`Total @ ${price}: ${roundedTotal} ${asset.currency}`);
        return roundedTotal;
    }

    /**
     * Returns the available balance of the account, in BTC
     * This is the amount of the account that can actually be traded.
     * If it is less that the total amount, some of the value will be
     * locked up in orders, or is on the wrong side of the account
     * (eg, if you want to buy BTC, then only the available USD will
     * be taken into account).
     * @param symbol - eg BTCUSD
     * @param balances
     * @param price
     * @param side
     */
    balanceAvailableAsset(symbol, balances, price, side) {
        const asset = this.splitSymbol(symbol);
        const spendable = balances.reduce((total, item) => {
            if (side === 'buy') {
                // looking to buy BTC, so need to know USD available
                if (item.currency === asset.currency) {
                    return total + (parseFloat(item.available) / price);
                }
            } else if (item.currency === asset.asset) {
                return total + parseFloat(item.available);
            }

            return total;
        }, 0);

        const roundedTotal = util.roundDown(spendable, 4);
        logger.results(`Asset balance @ ${price}: ${roundedTotal}`);
        return roundedTotal;
    }

    /**
     * Calculate the size of the order, taking into account available balance
     * @param symbol
     * @param side
     * @param amount - an amount as a number of coins or % of total worth
     * @param balances
     * @param price
     * @returns {{total: *, available: *, isAllAvailable: boolean, orderSize: *}}
     */
    calcOrderSize(symbol, side, amount, balances, price) {
        const asset = this.splitSymbol(symbol);
        const total = this.balanceTotalAsset(symbol, balances, price);
        const available = this.balanceAvailableAsset(symbol, balances, price, side);

        // calculate the order size (% or absolute, within limits, rounded)
        let orderSize = amount.value;
        if (amount.units === '%') orderSize = total * (amount.value / 100);
        if (amount.units === '%%') orderSize = available * (amount.value / 100);
        if (amount.units.toLowerCase() === asset.currency) orderSize = amount.value / price;

        // make sure it's no more than what we have available.
        orderSize = orderSize > available ? available : orderSize;

        // Prevent silly small orders
        if (orderSize < this.minOrderSize) {
            orderSize = 0;
        }

        return {
            total,
            available,
            isAllAvailable: (orderSize === available),
            orderSize: util.roundDown(orderSize, 4),
        };
    }

    /**
     * Figure out the absolute price to trade at, given an offset from the current price
     * @param symbol
     * @param side
     * @param offsetStr
     * @returns {Promise<any>}
     */
    async offsetToAbsolutePrice(symbol, side, offsetStr) {
        // Look for an absolute price (eg @6250.23)
        const regex = /@([0-9]+(\.[0-9]*)?)/;
        const m = regex.exec(offsetStr);
        if (m) {
            return Promise.resolve(util.roundDown(parseFloat(m[1]), 4));
        }

        // must be a regular offset or % offset, so we'll need to know the current price
        const orderbook = await this.support.ticker({ ex: this, symbol });
        const offset = this.parseQuantity(offsetStr);
        if (side === 'buy') {
            const currentPrice = parseFloat(orderbook.bid);
            const finalOffset = offset.units === '%' ? currentPrice * (offset.value / 100) : offset.value;
            return util.roundDown(currentPrice - finalOffset, 2);
        }
        const currentPrice = parseFloat(orderbook.ask);
        const finalOffset = offset.units === '%' ? currentPrice * (offset.value / 100) : offset.value;
        return util.roundDown(currentPrice + finalOffset, 2);
    }

    /**
     * Find the order size from the amount
     * @param symbol
     * @param side
     * @param orderPrice
     * @param amountStr
     * @returns {Promise<{total: *, available: *, isAllAvailable: boolean, orderSize: *}>}
     */
    async orderSizeFromAmount(symbol, side, orderPrice, amountStr) {
        const balances = await this.support.accountBalances({ ex: this, symbol });
        const amount = this.parseQuantity(amountStr);

        // Finally, work out the size of the order
        return this.calcOrderSize(symbol, side, amount, balances, orderPrice);
    }

    /**
     * Converts a target position size to an amount to trade
     * Default behaviour here is just to use the amount. Leveraged exchanges
     * might work out the diff needed to get to the target position and use that instead.
     * @param symbol
     * @param position - positive for long positions, negative for short positions
     * @param side
     * @param amount
     * @returns {*}
     */
    async positionToAmount(symbol, position, side, amount) {
        // First see if we work using a target position, or a fixed amount
        if (position === '') {
            // use the amount as an absolute change (units not support here)
            return Promise.resolve({ side, amount: this.parseQuantity(amount) });
        }

        // They asked for a position, instead of a side / amount compbo,
        // so work out the side and amount
        const balances = await this.support.accountBalances({ ex: this, symbol });

        // Add up all the coins on the asset side
        const asset = this.splitSymbol(symbol);
        const total = balances.reduce((t, item) => {
            if (item.currency === asset.asset) {
                return t + parseFloat(item.amount);
            }

            return t;
        }, 0);

        // We want `position`, but have `total`
        const target = parseFloat(position);
        const change = util.roundDown(target - total, 4);

        return { side: change < 0 ? 'sell' : 'buy', amount: { value: Math.abs(change), units: '' } };
    }

    /**
     * Just wait for a file, with no output
     * @param delay
     * @returns {Promise<any>}
     */
    waitSeconds(delay) {
        return new Promise((resolve) => {
            setTimeout(() => resolve({}), delay * 1000);
        });
    }
}

module.exports = Exchange;

