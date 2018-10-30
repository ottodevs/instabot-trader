const crypto = require('crypto');
const request = require('request');
const async = require('async');
const log = require('../common/logger');
const ApiInterface = require('./api');

const logger = log.logger;


class BitfinexApiv1 extends ApiInterface {
    /**
     * Set up the API
     * @param key
     * @param secret
     */
    constructor(key, secret) {
        super(key, secret);

        // the endpoint
        this.url = 'https://api.bitfinex.com';
        this.version = 'v1';

        // Keep hold of the API key and secret
        this.key = key;
        this.secret = secret;

        // rate limiting - when can we next make a call, and how often (in ms)
        this.nextCallAt = Date.now();
        this.minTimeBetweenCalls = 1000;

        // the nonce will start at now and gets incremented with each call
        this.nonce = Date.now();
        this.generateNonce = () => { this.nonce += 1; return this.nonce; };
    }

    /**
     * make an API call and reties it a few times if the call failed
     * @param requestOptions
     * @param maxAttempts
     * @param cb
     */
    callAPIWithRetries(requestOptions, maxAttempts, cb) {
        async.retry({
            times: maxAttempts,
            interval: retryCount => 28000 + (5000 * retryCount),
            errorFilter: err => (err === 503 || err === 502 || err === 429),
        }, (next) => {
            const t0 = Date.now();
            request(requestOptions, (error, response, body) => {
                const t1 = Date.now();
                const duration = (t1 - t0).toFixed(3);
                logger.debug(`${requestOptions.method} to ${requestOptions.url} took ${duration}ms`);

                if (error) {
                    logger.error('Error calling Bitfinex API v1');
                    logger.error(error);

                    // look for connection reset error (we'll treat as overloaded)
                    if ((typeof error === 'object') && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
                        // treat this as a rate limit, so we'll wait and try again
                        return next(429, 0);
                    }

                    return next(error, 0);
                }

                // Dump the output of the API call
                if (response && response.statusCode !== 200) {
                    logger.error(`Error calling Bitfinex API v1 - ${requestOptions.url}`);
                    logger.error(`Status Code: ${response.statusCode}\n`);
                    try {
                        const json = JSON.parse(body);
                        logger.error(json);
                    } catch (e) {
                        logger.error(`Exception parsing body. Response Code: ${response.statusCode}`);
                        if (body) {
                            logger.error('Response Body:');
                            logger.error(body);
                        }
                    }
                }

                if (response && response.statusCode !== 200) {
                    return next(response.statusCode, body);
                }

                // try and extract the response
                try {
                    const result = JSON.parse(body);

                    // See if it contains an error message
                    if (result.error) {
                        return next(new Error(result.error));
                    }

                    // All OK
                    return next(null, result);
                } catch (e) {
                    // Basically, the response was not json
                    return next(null, {
                        message: body.toString(),
                    });
                }
            });
        }, (err, result) => {
            // set the next call time...
            this.nextCallAt = Date.now() + this.minTimeBetweenCalls;
            // do something with the result
            if (err) {
                logger.error('Bitfinex API call failed. not retrying.');
            }
            cb(err, result);
        });
    }

    /**
     * Calls the bitfinex API
     * @param url
     * @param method
     * @param headers
     * @returns {*}
     */
    callAPI(url, method, headers) {
        const requestOptions = {
            url,
            method,
            headers,
            timeout: 10000,
        };

        // Figure out if we need to rate limit ourselves a bit
        const currentTime = Date.now();
        const waitBeforeCall = this.nextCallAt > currentTime ? (this.nextCallAt - currentTime) + 1 : 1;
        if (waitBeforeCall > 1) logger.dim(`Rate limiting myself by waiting ${waitBeforeCall}ms`);

        // make the call
        return new Promise((resolve, reject) => {
            setTimeout(() => this.callAPIWithRetries(requestOptions, 10, (err, response) => {
                if (err) return reject(err);
                return resolve(response);
            }), waitBeforeCall);
        });
    }

    /**
     * Makes an Auth request to the API
     * @param path
     * @param params
     * @returns {*}
     */
    makeAuthRequest(path, params) {
        // var headers, key, nonce, path, payload, signature, url, value
        if (!this.key || !this.secret) {
            return Promise.reject(new Error('missing api key or secret'));
        }

        const url = `${this.url}/${this.version}/${path}`;
        const nonce = JSON.stringify(this.generateNonce());

        const payload = Object.assign({
            request: `/v1/${path}`,
            nonce,
        }, params);

        const stringToSign = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto.createHmac('sha384', this.secret).update(stringToSign).digest('hex');

        const headers = {
            'X-BFX-APIKEY': this.key,
            'X-BFX-PAYLOAD': stringToSign,
            'X-BFX-SIGNATURE': signature,
        };

        return this.callAPI(url, 'POST', headers);
    }

    /**
     * Make a public request to the API
     * @param path
     * @returns {*}
     */
    makePublicRequest(path) {
        const url = `${this.url}/${this.version}/${path}`;
        return this.callAPI(url, 'GET', {});
    }

    /**
     * Get the ticker for a symbol
     * @param symbol
     * @returns {*}
     */
    ticker(symbol) {
        return this.makePublicRequest(`pubticker/${symbol}`);
    }

    /**
     * Get the balances
     * @returns {*}
     */
    walletBalances() {
        return this.makeAuthRequest('balances', {});
    }

    /**
     * Place a new order
     * @param symbol
     * @param amount
     * @param price
     * @param side
     * @param type - one of the bitfinex order types
     * @param isEverything
     */
    newOrder(symbol, amount, price, side, type, isEverything) {
        const params = {
            symbol,
            amount: String(amount),
            price: String(price),
            exchange: 'bitfinex',
            side,
            type,
        };

        if (isEverything) params.use_all_available = 1;

        return this.makeAuthRequest('order/new', params);
    }

    /**
     * place a limit order
     * @param symbol
     * @param amount
     * @param price
     * @param side
     * @param isEverything
     * @returns {*}
     */
    limitOrder(symbol, amount, price, side, isEverything) {
        return this.newOrder(symbol, amount, price, side, 'exchange limit', isEverything);
    }

    /**
     * Place a market order
     * @param symbol
     * @param amount
     * @param side - buy or sell
     * @param isEverything
     */
    marketOrder(symbol, amount, side, isEverything) {
        return this.newOrder(symbol, amount, 0, side, 'exchange market', isEverything);
    }

    /**
     * Place a stop market order
     * @param symbol
     * @param amount
     * @param price
     * @param side - buy or sell
     * @param trigger
     */
    stopOrder(symbol, amount, price, side, trigger) {
        return this.newOrder(symbol, amount, price, side, 'exchange stop', false);
    }

    /**
     * Get active orders
     * @param symbol
     * @param side - buy, sell or all
     * @returns {PromiseLike<T> | Promise<T>}
     */
    activeOrders(symbol, side) {
        return this.makeAuthRequest('orders', {})
            .then(orders => orders.filter(order => ((side === 'buy' || side === 'sell') ? order.side === side : true)));
    }

    /**
     * Cancel orders
     * @param orders - and array of orders to cancel
     * @returns {*}
     */
    cancelOrders(orders) {
        const params = {
            order_ids: orders.map(order => order.id),
        };

        return this.makeAuthRequest('order/cancel/multi', params);
    }

    /**
     * Get order info
     * @param orderInfo
     * @returns {PromiseLike<{id: *, side: *, amount: number, remaining: number, executed: number, is_filled: boolean}> | Promise<{id: *, side: *, amount: number, remaining: number, executed: number, is_filled: boolean}>}
     */
    order(orderInfo) {
        const params = {
            order_id: orderInfo.id,
        };

        return this.makeAuthRequest('order/status', params)
            .then(order => ({
                id: order.id,
                side: order.side,
                amount: parseFloat(order.original_amount),
                remaining: parseFloat(order.remaining_amount),
                executed: parseFloat(order.executed_amount),
                is_filled: parseFloat(order.remaining_amount) === 0,
                is_open: !order.is_cancelled,
            }));
    }
}

module.exports = BitfinexApiv1;
