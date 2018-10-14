const async = require('async');
const config = require('config');
const logger = require('../common/logger').logger;
const util = require('../common/util');
const Fregex = require('../common/functional-regex');
const Cache = require('../common/cache');
const EasingFunction = require('../common/easing');
const notifier = require('../notifications/notifier');


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
        this.commandWhiteList = [
            'wait', 'scaledOrder', 'steppedMarketOrder', 'stopMarketOrder',
            'macro', 'notify', 'balance'];
        this.credentials = credentials;
        this.refCount = 1;

        this.minOrderSize = 0.001;
        this.sessionOrders = [];

        this.macros = [];

        this.api = null;
        this.cache = new Cache();
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
     * Add commands to the whitelist
     * @param whitelist
     */
    addCommands(whitelist) {
        this.commandWhiteList = this.commandWhiteList.concat(whitelist);
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
        // Grab the macros from config, remap it to how we want it
        // and strip out any macros for commands that exist
        const macroList = config.get('macros');
        const filterMacros = macroList.map(item => ({ name: item.name, actions: item.actions.join(' ') }))
            .filter(item => this.commandWhiteList.findIndex(el => item.name === el) === -1)
            .filter(item => (typeof this[item.name] !== 'function'));

        // Add all the macros that survived to the whitelist
        filterMacros.forEach((item) => { this.commandWhiteList.push(item.name); });
        this.macros = filterMacros;
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
     * Converts a time string (12, 12s, 12h, 12m) to an int number of seconds
     * @param time
     * @param defValue
     * @returns {number}
     */
    timeToSeconds(time, defValue = 10) {
        const regex = /([0-9]+)(h|m|s)?/;
        const m = regex.exec(time);
        if (m !== null) {
            const delay = parseInt(m[1], 10);

            switch (m[2]) {
                case 'm':
                    return delay * 60;

                case 'h':
                    return delay * 60 * 60;
            }

            return delay;
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
     * Parse the individual arguments in the function
     * @param params
     * @returns {Array}
     */
    parseArguments(params) {
        // Break the arguments up into each individual argument
        const argList = [];
        const splitByComma = new Fregex();
        splitByComma.forEach(/([^,]+?\"[^\"]+\")|([^,]+)/g, params, (m, i) => {
            argList.push(m[0].trim());
        });

        // then work out the named values etc
        const res = [];
        argList.forEach((item, i) => {
            const splitValues = /^(([a-zA-Z]+)\s*=\s*(("([^"]*)")|"?(.+)"?))|(.+)$/;
            const m = splitValues.exec(item);
            if (m) {
                if (m[7]) {
                    // this is the plain argument case (no named arguments)
                    const quotes = /^"(.*)"$/.exec(m[7]);
                    const value = quotes ? quotes[1] : m[7];
                    res.push({ name: '', value, index: i });
                } else if (m[6]) {
                    res.push({ name: m[2], value: m[6], index: i });
                } else if (m[5]) {
                    res.push({ name: m[2], value: m[5], index: i });
                }
            }
        });

        return res;
    }

    /**
     * Helper to parse all the actions and return an array of what needs to be done
     * @param commands
     * @returns {Array}
     */
    parseActions(commands) {
        const actions = [];
        const regex = new Fregex();
        regex.forEach(/([a-z]+)\(([\s\S]*?)\)/gi, commands, (m) => {
            actions.push({
                name: m[1].trim(),
                params: this.parseArguments(m[2].trim()),
            });
        });

        return actions;
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
     * @param balance
     * @param price
     */
    balanceTotalAsset(symbol, balance, price) {
        // Work out the total value of the portfolio
        const asset = this.splitSymbol(symbol);
        const total = balance.reduce((t, item) => {
            if (item.currency === asset.currency) {
                return t + (parseFloat(item.amount) / price);
            } else if (item.currency === asset.asset) {
                return t + parseFloat(item.amount);
            }

            return t;
        }, 0);

        const roundedTotal = util.roundDown(total, 4);
        logger.results(`Total equity @ ${price}: ${roundedTotal} ${asset.asset}`);
        return roundedTotal;
    }

    /**
     * Get the balance total in the fiat currency
     * @param symbol
     * @param balance
     * @param price
     * @returns {*}
     */
    balanceTotalFiat(symbol, balance, price) {
        // Work out the total value of the portfolio
        const asset = this.splitSymbol(symbol);
        const total = balance.reduce((t, item) => {
            if (item.currency === asset.currency) {
                return t + parseFloat(item.amount);
            } else if (item.currency === asset.asset) {
                return t + (parseFloat(item.amount) * price);
            }

            return t;
        }, 0);

        const roundedTotal = util.roundDown(total, 4);
        logger.results(`Total equity @ ${price}: ${roundedTotal} ${asset.currency}`);
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
     * @param balance
     * @param price
     * @param side
     */
    balanceAvailableAsset(symbol, balance, price, side) {
        const asset = this.splitSymbol(symbol);
        const spendable = balance.reduce((total, item) => {
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
        logger.results(`Spendable balance @ ${price}: ${roundedTotal}`);
        return roundedTotal;
    }

    /**
     * Calculate the size of the order, taking into account available balance
     * @param symbol
     * @param side
     * @param amount - an amount as a number of coins or % of total worth
     * @param balance
     * @param price
     * @returns {{total: *, available: *, isAllAvailable: boolean, orderSize: *}}
     */
    calcOrderSize(symbol, side, amount, balance, price) {
        const asset = this.splitSymbol(symbol);
        const total = this.balanceTotalAsset(symbol, balance, price);
        const available = this.balanceAvailableAsset(symbol, balance, price, side);

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
        const orderbook = await this.ticker(symbol);
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
    orderSizeFromAmount(symbol, side, orderPrice, amountStr) {
        return this.accountWalletBalances(symbol)
            .then((balances) => {
                const amount = this.parseQuantity(amountStr);

                // Finally, work out the size of the order
                return this.calcOrderSize(symbol, side, amount, balances, orderPrice);
            });
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
        const balance = await this.accountWalletBalances(symbol);

        // Add up all the coins on the asset side
        const asset = this.splitSymbol(symbol);
        const total = balance.reduce((t, item) => {
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
     * Support for named params
     * @param expected - map of expected values, with default {name: default}
     * @param named - the input argument list
     * @returns map of the arguments { name: value }
     */
    assignParams(expected, named) {
        const result = {};
        for (const attr in expected) {
            if (expected.hasOwnProperty(attr)) result[attr] = expected[attr];
        }

        Object.keys(expected).forEach((item, i) => {
            result[item] = named.reduce((best, p) => {
                if ((p.name.toLowerCase() === item.toLowerCase()) || (p.name === '' && p.index === i)) {
                    return p.value;
                }
                return best;
            }, result[item]);
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
        if (!toExecute) {
            logger.error(`Unknown command: ${name}`);
            return Promise.reject('unknown command');
        }

        // See if we have a function of that name
        if (typeof this[toExecute] === 'function') {
            return this[toExecute](symbol, params, session);
        }

        // Did not find it as a function in the class, so see if it is a macro
        const args = this.parseArguments(`func=${toExecute}`);
        return this.macro(symbol, args, session);
    }

    /**
     * Waits for N seconds
     * wait(Seconds)
     * @param symbol
     * @param args
     */
    wait(symbol, args) {
        const params = this.assignParams({ duration: '10s' }, args);
        logger.progress(`WAIT - ${this.name}`);
        logger.progress(params);

        return new Promise((resolve) => {
            const delay = this.timeToSeconds(params.duration, 10);
            logger.progress(`Waiting for ${delay} seconds.`);

            setTimeout(() => {
                resolve({});
            }, delay * 1000);
        });
    }

    /**
     * Work out the actual order size for hte scaled order
     * taking into account the available funds and the order size and prices
     * Simple enough for buy orders, as everything is measured in assets (eg btc)
     * For selling, we have to work out equivalent values in currency (usd) and scaled to fit.
     * @param symbol
     * @param params - from scaled order
     * @returns {Promise<*>}
     */
    async scaledOrderSize(symbol, params) {
        // If the units are anything other than 'asset', then just go with it
        if (params.amount.units !== '') {
            return params.amount.value;
        }

        // Things we'll need along the way
        const asset = this.splitSymbol(symbol);
        const wallet = await this.accountWalletBalances(symbol);
        const desiredAmount = params.amount.value;
        const orderCount = params.orderCount;
        let assetToSpend = 0;

        // if selling (simple case, dealing with asset values), find out how much Asset is available
        if (params.side === 'sell') {
            const assetAvailable = wallet.reduce((available, item) => available + (asset.asset === item.currency ? parseFloat(item.available) : 0), 0);
            assetToSpend = (assetAvailable < desiredAmount) ? assetAvailable : desiredAmount;
        } else {
            // Not selling - Buying, so have to cross work everything out in base currency
            // build a list of all the order prices...
            const prices = [];
            for (let i = 0; i < orderCount; i++) {
                prices.push(util.round(EasingFunction(params.from, params.to, i / (orderCount - 1), params.easing), 2));
            }

            // Work out the currency equivalent for this set of orders
            const amountPerOrder = desiredAmount / orderCount;
            const currencyNeeded = prices.reduce((total, item) => total + (item * amountPerOrder), 0);

            // Figure out the funds available.
            const currencyAvailable = wallet.reduce((available, item) => available + (asset.currency === item.currency ? parseFloat(item.available) : 0), 0);

            // Adjust our order size based on this
            assetToSpend = (currencyAvailable < currencyNeeded) ?
                desiredAmount * (currencyAvailable / currencyNeeded) :
                desiredAmount;
        }

        // Would this result in trying to place orders below the min order size?
        if ((assetToSpend / orderCount) < this.minOrderSize) {
            return 0;
        }

        // We had enough funds, so just do as they asked
        return util.roundDown(assetToSpend, 6);
    }

    /**
     * Place a scaled order
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<any>}
     */
    async scaledOrder(symbol, args, session) {
        const params = this.assignParams({
            from: '0',
            to: '50',
            orderCount: '20',
            amount: '0',
            side: 'buy',
            easing: 'linear',
            tag: '',
            position: '',
        }, args);

        // show a little progress
        logger.progress(`SCALED ORDER - ${this.name}`);
        logger.progress(params);

        // get the values as numbers
        params.orderCount = parseInt(params.orderCount, 10);
        if (params.orderCount < 1) params.orderCount = 1;
        if (params.orderCount > 50) params.orderCount = 50;

        // Figure out the size of each order
        const modifiedPosition = await this.positionToAmount(symbol, params.position, params.side, params.amount);
        if (params.amount.value === 0) {
            logger.results('Scaled order not placed, as order size is Zero.');
            return Promise.resolve({});
        }

        // So we now know the desired position size and direction
        params.side = modifiedPosition.side;
        params.amount = modifiedPosition.amount;

        // Get from and to as absolute prices
        params.from = await this.offsetToAbsolutePrice(symbol, params.side, params.from);
        params.to = await this.offsetToAbsolutePrice(symbol, params.side, params.to);

        // Adjust the size to take into account available funds
        params.amount.value = await this.scaledOrderSize(symbol, params);
        if (params.amount.value === 0) {
            logger.results('Scaled order would result in trying to place orders below min order size. Ignoring.');
            return Promise.resolve({});
        }

        logger.progress('Adjusted values based on Available Funds');
        logger.progress(params);

        // figure out how big each order needs to be
        const perOrderSize = util.roundDown(params.amount.value / params.orderCount, 6);
        params.amount = `${perOrderSize}${params.amount.units}`;

        // map the amount to a scaled amount (amount / steps, but keep units (eg %))
        return new Promise((resolve, reject) => async.timesSeries(params.orderCount, (i, next) => {
            // Work out the settings to place a limit order
            const price = util.round(EasingFunction(params.from, params.to, i / (params.orderCount - 1), params.easing), 2);
            const limitOrderArgs = [
                { name: 'side', value: params.side, index: 0 },
                { name: 'offset', value: `@${price}`, index: 1 },
                { name: 'amount', value: params.amount, index: 2 },
                { name: 'tag', value: params.tag, index: 3 },
            ];

            // Place the order
            this.limitOrder(symbol, limitOrderArgs, session).then((res) => {
                next(null, res);
            }).catch((err) => {
                logger.error(`Error placing a limit order as part of a scaled order- ${err}`);
                logger.error('Continuing to try and place the rest of the series...');
                next(null, {});
            });
        }, err => (err ? reject(err) : resolve({}))));
    }

    /**
     * Place a series of market orders at intervals
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<any>}
     */
    async steppedMarketOrder(symbol, args, session) {
        const params = this.assignParams({
            side: 'buy',
            amount: '0',
            orderCount: '10',
            duration: '60s',
            position: '',
        }, args);

        // show a little progress
        logger.progress(`STEPPED MARKET ORDER - ${this.name}`);
        logger.progress(params);

        // get the values as numbers
        params.orderCount = parseInt(params.orderCount, 10);

        // clamp them into range
        if (params.orderCount < 1) params.orderCount = 1;
        if (params.orderCount > 50) params.orderCount = 50;
        if (params.duration < 1) params.duration = 1;

        // Work out how long to wait between each order (in ms)
        const timeGap = util.roundDown((this.timeToSeconds(params.duration, 60) / params.orderCount) * 1000, 0);

        // Figure out the size of each order
        const modifiedPosition = await this.positionToAmount(symbol, params.position, params.side, params.amount);
        if (params.amount.value === 0) {
            logger.results('stepped market order not placed, as order size is Zero.');
            return Promise.resolve({});
        }

        // Capture the modified size and direction information
        params.side = modifiedPosition.side;
        params.amount = modifiedPosition.amount;

        // figure out how big each order needs to be
        const perOrderSize = util.roundDown(params.amount.value / params.orderCount, 6);
        params.amount = `${perOrderSize}${params.amount.units}`;

        // map the amount to a scaled amount (amount / steps, but keep units (eg %))
        return new Promise((resolve, reject) => {
            async.timesSeries(params.orderCount, (i, next) => {
                // Work out the settings to place a limit order
                const marketOrderArgs = [
                    { name: 'side', value: params.side, index: 0 },
                    { name: 'amount', value: params.amount, index: 1 },
                ];

                // Place the order (then wait timeGap ms before moving on to the next one)
                this.marketOrder(symbol, marketOrderArgs, session).then((res) => {
                    setTimeout(() => next(null, res), timeGap);
                }).catch((err) => {
                    logger.error(`Error placing a market order as part of a stepped order- ${err}`);
                    logger.error('Continuing to try and place the rest of the series...');
                    setTimeout(() => next(null, {}), timeGap);
                });
            }, err => (err ? reject(err) : resolve({})));
        });
    }

    /**
     * Gets the current prices at the top of the order book
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<any>}
     */
    async ticker(symbol, args, session) {
        // Can we get this from the cache?
        const key = `${session}ticker`;
        const cachedTicker = this.cache.get(key);
        if (cachedTicker) {
            logger.dim('Ticker from cache');
            logger.dim(cachedTicker);
            return Promise.resolve(cachedTicker);
        }

        // Nope, so fetch it
        const orderBook = await this.api.ticker(symbol);
        logger.dim(orderBook);
        this.cache.put(key, orderBook, 30);

        return orderBook;
    }

    /**
     * Get the balances on the account
     * @param symbol
     * @returns {Promise<any>}
     */
    async accountWalletBalances(symbol) {
        // Fetch the actual wallet balance
        const wallet = await this.api.walletBalances();

        // Filter it to just the symbol we are working with
        const assets = this.splitSymbol(symbol);
        const filtered = wallet.filter(item => item.type === 'exchange' && (item.currency === assets.asset || item.currency === assets.currency));
        logger.dim(filtered);

        return filtered;
    }

    /**
     * Place a limit order
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<any>}
     */
    async limitOrder(symbol, args, session) {
        // map the arguments
        const params = this.assignParams({
            side: 'buy',
            offset: '0',
            amount: '0',
            tag: new Date().toISOString(),
            position: '',
        }, args);

        // show a little progress
        logger.progress(`LIMIT ORDER - ${this.name}`);
        logger.progress(params);

        // Validate the side
        if ((params.side !== 'buy') && (params.side !== 'sell')) {
            return Promise.reject(new Error('side must be buy or sell'));
        }

        const modifiedPosition = await this.positionToAmount(symbol, params.position, params.side, params.amount);
        if (modifiedPosition.amount.value === 0) {
            logger.results('limit order not placed, as order size is Zero.');
            return Promise.resolve({});
        }

        // Capture the modified size and direction information
        const side = modifiedPosition.side;
        const amountStr = `${modifiedPosition.amount.value}${modifiedPosition.amount.units}`;

        // Try and place the order
        const orderPrice = await this.offsetToAbsolutePrice(symbol, side, params.offset);
        const details = await this.orderSizeFromAmount(symbol, side, orderPrice, amountStr);
        if (details.orderSize === 0) {
            return Promise.reject('No funds available or order size is 0');
        }

        // Place the order
        const order = await this.api.limitOrder(symbol, details.orderSize, orderPrice, side, details.isAllAvailable);
        this.addToSession(session, params.tag, order);
        logger.results('Limit order placed.');
        logger.dim(order);
        return order;
    }

    /**
     * Place a market order
     * @param symbol
     * @param args
     * @returns {Promise<any>}
     */
    async marketOrder(symbol, args) {
        // map the arguments
        const params = this.assignParams({
            side: 'buy',
            amount: '0',
            position: '',
        }, args);

        // show a little progress
        logger.progress(`MARKET ORDER - ${this.name}`);
        logger.progress(params);

        // Validate the side
        if ((params.side !== 'buy') && (params.side !== 'sell')) {
            return Promise.reject(new Error('side must be buy or sell'));
        }

        // Convert a position to an amount to order (if needed)
        const modifiedPosition = await this.positionToAmount(symbol, params.position, params.side, params.amount);
        if (modifiedPosition.amount.value === 0) {
            // Nothing to do
            logger.results('market order not placed, as order size is Zero.');
            return Promise.resolve({});
        }

        // Capture the modified size and direction information
        const side = modifiedPosition.side;
        const amountStr = `${modifiedPosition.amount.value}${modifiedPosition.amount.units}`;

        // convert the amount to an actual order size.
        const orderPrice = await this.offsetToAbsolutePrice(symbol, side, '0');
        const details = await this.orderSizeFromAmount(symbol, side, orderPrice, amountStr);
        if (details.orderSize === 0) {
            return Promise.reject('No funds available or order size is zero');
        }

        // Finally place the order
        const order = await this.api.marketOrder(symbol, details.orderSize, side, details.isAllAvailable);
        logger.dim(order);
        return order;
    }


    /**
     * Place a stop order
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<any>}
     */
    async stopMarketOrder(symbol, args, session) {
        // map the arguments
        const params = this.assignParams({
            side: 'buy',
            offset: '0',
            amount: '0',
            tag: new Date().toISOString(),
            position: '',
            trigger: 'mark',
        }, args);

        // show a little progress
        logger.progress(`STOP MARKET ORDER - ${this.name}`);
        logger.progress(params);

        // make sure trigger is a supported value
        if (params.trigger !== 'mark' && params.trigger !== 'index' && params.trigger !== 'last') {
            logger.error(`Stop Market Order trigger of ${params.trigger} not supported. Defaulting to mark price`);
            params.trigger = 'mark';
        }

        // Validate the side
        if ((params.side !== 'buy') && (params.side !== 'sell')) {
            return Promise.reject(new Error('side must be buy or sell'));
        }

        // Figure out the amount to trade
        const modifiedPosition = await this.positionToAmount(symbol, params.position, params.side, params.amount);
        if (modifiedPosition.amount.value === 0) {
            logger.results('Stop market order not placed, as order size is Zero.');
            return Promise.resolve({});
        }

        // Capture the modified size and direction information
        const side = modifiedPosition.side;
        const amountStr = `${modifiedPosition.amount.value}${modifiedPosition.amount.units}`;

        const orderPrice = await this.offsetToAbsolutePrice(symbol, side === 'buy' ? 'sell' : 'buy', params.offset);
        const details = await this.orderSizeFromAmount(symbol, side, orderPrice, amountStr);
        if (details.orderSize === 0) {
            return Promise.reject('No funds available or order size is 0');
        }

        const order = await this.api.stopOrder(symbol, details.orderSize, orderPrice, side, params.trigger);
        this.addToSession(session, params.tag, order);
        logger.results('Stop market order placed.');
        logger.dim(order);
        return order;
    }

    /**
     * Close some orders
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<any>}
     */
    cancelOrders(symbol, args, session) {
        // map the arguments
        const params = this.assignParams({
            // buy, sell, all, session (all orders from session),
            // tagged (all with matching tag in session)
            which: 'session',

            // used when which is tagged
            tag: '',
        }, args);

        logger.progress(`CANCEL ORDERS - ${this.name}`);
        logger.progress(params);

        // go do some work
        switch (params.which) {
            case 'buy':
            case 'sell':
            case 'all':
                // get the active orders from the API
                // Filter down to just the side we want
                return this.api.activeOrders(symbol, params.which)
                    .then(orders => this.api.cancelOrders(orders));

            case 'tagged':
                // map the result to a list of order ids
                return this.api.cancelOrders(this.findInSession(session, params.tag));

            default:
            case 'session':
                // map the result to a list of order ids
                return this.api.cancelOrders(this.findInSession(session, null));
        }
    }

    /**
     * Report account details
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<string>}
     */
    async balance(symbol, args, session) {
        logger.progress('NOTIFY ACCOUNT BALANCE');

        const balances = await this.accountWalletBalances(symbol);
        const orderbook = await this.ticker(symbol);

        const assets = this.splitSymbol(symbol);
        const price = parseFloat(orderbook.last_price);

        const totalFiat = util.roundDown(this.balanceTotalFiat(symbol, balances, price), 2);
        const totalCoins = util.roundDown(this.balanceTotalAsset(symbol, balances, price), 4);
        const balanceCoins = util.roundDown(balances.reduce((t, item) => (t + (item.currency === assets.asset ? parseFloat(item.amount) : 0)), 0), 4);
        const balanceFiat = util.roundDown(balances.reduce((t, item) => (t + (item.currency === assets.currency ? parseFloat(item.amount) : 0)), 0), 2);

        const msg = `${this.name}: Balances - ${balanceCoins} ${assets.asset} & ${balanceFiat} ${assets.currency}. ` +
            `Total Value - ${totalCoins} ${assets.asset} (${totalFiat} ${assets.currency}).`;
        notifier.send(msg);
        logger.results(msg);

        return msg;
    }

    /**
     * Send a message to slack
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<string>}
     */
    notify(symbol, args, session) {
        const params = this.assignParams({
            msg: 'Message from Instabot Trader',
            title: '',
            color: 'good',
            text: ':moneybag:',
            footer: 'from instabot trader - not financial advice.',
            who: 'default',
        }, args);

        logger.progress(`NOTIFICATION MESSAGE - ${this.name}`);
        logger.progress(params);

        notifier.send(params.msg, params, params.who.toLowerCase());
        return Promise.resolve();
    }

    /**
     * Run a macro
     * @param symbol
     * @param args
     * @param session
     * @returns {Promise<any>}
     */
    macro(symbol, args, session) {
        const params = this.assignParams({
            func: '',
            tag: '',
        }, args);

        return new Promise((resolve, reject) => {
            const commands = this.macros.find(item => item.name === params.func);
            if (!commands) {
                return reject(new Error(`No macro named ${params.func} found.`));
            }

            // Parse the macro and run it
            const actions = this.parseActions(commands.actions);
            return async.eachSeries(actions, (action, next) => {
                logger.progress(`Macro running command ${action.name}`);
                this.executeCommand(symbol, action.name, action.params, session)
                    .then(() => next())
                    .catch(err => next(err));
            }, err => ((err) ? reject(err) : resolve()));
        });
    }
}

module.exports = Exchange;

