const crypto = require('crypto');
const request = require('request');
const async = require('async');
const log = require('../common/logger');
const util = require('../common/util');
const ApiInterface = require('./api');

const logger = log.logger;


/**
 * Deribit API Wrapper
 * https://docs.deribit.com/rpc-endpoints.html#account
 */
class DeribitApi extends ApiInterface {
    /**
     * Set up the API
     * @param key
     * @param secret
     */
    constructor(key, secret) {
        super(key, secret);

        // the endpoint
        this.url = 'https://www.deribit.com';

        // Keep hold of the API key and secret
        this.key = key;
        this.secret = secret;

        // whole numbers of contracts only...
        this.precision = 0;
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
            interval: retryCount => 15000 + (5000 * retryCount),
            errorFilter: err => (err === 503 || err === 502 || err === 429),
        }, (next) => {
            const t0 = Date.now();
            request(requestOptions, (error, response, body) => {
                const t1 = Date.now();
                const duration = (t1 - t0).toFixed(3);
                logger.debug(`${requestOptions.method} to ${requestOptions.url} took ${duration}ms`);

                if (error) {
                    logger.error('Error calling Deribit API');
                    logger.error(error);

                    // look for connection reset error (we'll treat as overloaded)
                    if ((typeof error === 'object') && (error.code === 'ECONNRESET')) {
                        // treat this as a rate limit, so we'll wait and try again
                        return next(429, 0);
                    }

                    return next(error, 0);
                }

                // Dump the output of the API call
                if (response && response.statusCode !== 200) {
                    logger.error('Error calling Deribit API');
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
                        return next(new Error(`${result.error} - ${result.message}`));
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
            // do something with the result
            if (err) {
                logger.error('Derbit API call failed. not retrying.');
            }
            cb(err, result);
        });
    }

    /**
     * Calls the Deribit API
     * @param url
     * @param method
     * @param headers
     * @param data
     * @returns {*}
     */
    callAPI(url, method, headers, data) {
        const requestOptions = {
            url,
            method,
            headers,
            form: data,
            timeout: 10000,
        };

        // make the call
        return new Promise((resolve, reject) => {
            this.callAPIWithRetries(requestOptions, 10, (err, response) => {
                if (err) return reject(err);
                return resolve(response.result);
            });
        });
    }


    /**
     * Helper for the auth signatures
     * @param obj
     * @param encode
     * @returns {string}
     */
    objectToString(obj, encode) {
        const result = [];
        Object.keys(obj).sort().forEach((key) => {
            let value = obj[key];
            if (Array.isArray(value) && !encode) {
                value = value.join('');
            } else if (encode) {
                value = encodeURIComponent(value);
            }

            if (encode) {
                key = encodeURIComponent(key);
            }

            result.push(`${key}=${value}`);
        });

        return result.join('&');
    }

    /**
     * Makes an Auth request to the API
     * @param action
     * @param params
     * @param methodOrderride
     * @returns {*}
     */
    makeAuthRequest(action, params, methodOrderride) {
        // var headers, key, nonce, path, payload, signature, url, value
        if (!this.key || !this.secret) {
            return Promise.reject(new Error('missing api key or secret'));
        }

        let method = action.startsWith('/api/v1/public') ? 'GET' : 'POST';
        method = methodOrderride || method;
        const args = method === 'GET' ? `?${this.objectToString(params)}` : '';

        const url = `${this.url}${action}${args}`;

        const tstamp = new Date().getTime();
        const startingData = {
            _: tstamp,
            _ackey: this.key,
            _acsec: this.secret,
            _action: action,
        };

        const allData = Object.assign(startingData, params);
        const paramsString = this.objectToString(allData, false);

        const hash = crypto.createHash('sha256').update(paramsString).digest().toString('base64');
        const sig = `${this.key}.${tstamp.toString()}.${hash}`;
        const headers = {
            'x-deribit-sig': sig,
        };

        return this.callAPI(url, method, headers, params);
    }

    /**
     * Get the ticker for a symbol
     * @param symbol
     * @returns {*}
     */
    ticker(symbol) {
        const url = '/api/v1/public/getorderbook';
        const params = { instrument: symbol.toUpperCase() };
        return this.makeAuthRequest(url, params)
            .then(res => ({
                // standard data we need for this response
                bid: String(res.bids[0].price),
                ask: String(res.asks[0].price),
                last_price: String(res.last),

                // plus the full response for custom features
                // extra: res,
            }));
    }

    /**
     * No wallet balances in Deribit - all contracts...
     * @returns {*}
     */
    walletBalances() {
        return Promise.resolve([]);
    }

    /**
     * place a limit order
     * @param symbol
     * @param amount
     * @param price
     * @param side
     * @returns {*}
     */
    limitOrder(symbol, amount, price, side/* , isEverything */) {
        const params = {
            instrument: symbol.toUpperCase(),
            type: 'limit',
            quantity: String(util.roundDown(amount, 0)),
            price: String(util.round(price * 2, 0) / 2),
            time_in_force: 'good_till_cancel',
            post_only: true,
        };

        return this.makeAuthRequest(`/api/v1/private/${side}`, params)
            .then(orderInfo => orderInfo.order);
    }

    /**
     * Place a market order
     * @param symbol
     * @param amount
     * @param side - buy or sell
     */
    marketOrder(symbol, amount, side/* , isEverything */) {
        const params = {
            instrument: symbol.toUpperCase(),
            type: 'market',
            quantity: String(util.roundDown(amount, 0)),
        };

        return this.makeAuthRequest(`/api/v1/private/${side}`, params)
            .then(orderInfo => orderInfo.order);
    }

    /**
     * Place a stop market order
     * @param symbol
     * @param amount
     * @param price
     * @param side
     * @param trigger
     * @returns {*}
     */
    stopOrder(symbol, amount, price, side, trigger) {
        const params = {
            instrument: symbol.toUpperCase(),
            type: 'stop_market',
            quantity: String(util.roundDown(amount, 0)),
            stopPx: String(price),
            execInst: trigger === 'index' ? 'index_price' : 'mark_price', // index price or mark price used for stop trigger
            time_in_force: 'good_till_cancel',
            post_only: true,
        };

        return this.makeAuthRequest(`/api/v1/private/${side}`, params)
            .then(orderInfo => orderInfo.order);
    }

    /**
     * Find active orders
     * @param symbol
     * @param side - buy, sell or all
     * @returns {*}
     */
    activeOrders(symbol, side) {
        const params = {
            instrument: symbol.toUpperCase(),
        };

        return this.makeAuthRequest('/api/v1/private/getopenorders', params)
            .then(orders => orders.filter(order => ((side === 'buy' || side === 'sell') ? order.direction === side : true)));
    }

    /**
     * Cancel some orders
     * @param orders
     * @returns {*}
     */
    cancelOrders(orders) {
        return new Promise((resolve, reject) => {
            async.eachSeries(orders, (order, next) => this.makeAuthRequest('/api/v1/private/cancel', { orderId: order.orderId })
                .then(() => next())
                .catch(err => next()), (err, result) => {
                if (err) return reject(err);
                return resolve(result);
            });
        });
    }

    /**
     * Get order info
     * @param order
     * @returns {PromiseLike<{id: *, side: *, amount: number, remaining: number, executed: number, is_filled: boolean}> | Promise<{id: *, side: *, amount: number, remaining: number, executed: number, is_filled: boolean}>}
     */
    order(order) {
        return this.makeAuthRequest('/api/v1/private/orderstate', { orderId: order.orderId }, 'GET')
            .then(o => ({
                id: o.orderId,
                side: o.direction,
                amount: o.quantity,
                remaining: o.quantity - o.filledQuantity,
                executed: o.filledQuantity,
                is_filled: o.quantity === o.filledQuantity,
                is_open: o.state === 'open',
            }));
    }

    /**
     * Get account details
     * @returns {*}
     */
    account() {
        return this.makeAuthRequest('/api/v1/private/account', {});
    }

    /**
     * Gets the open positions
     * @returns {*}
     */
    positions() {
        return this.makeAuthRequest('/api/v1/private/positions', {});
    }
}

module.exports = DeribitApi;
