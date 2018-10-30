const log = require('../common/logger');
const Exchange = require('./exchange');
const CoinbaseApi = require('../apis/coinbase');

const logger = log.logger;


/**
 * Coinbase version of the exchange
 */
class Coinbase extends Exchange {
    /**
     * set up the supported commands and API
     * @param credentials
     */
    constructor(credentials) {
        super(credentials);
        this.name = 'coinbase';

        // start up any sockets or create API handlers here.
        this.api = new CoinbaseApi(credentials.key, credentials.secret, credentials.passphrase, credentials.endpoint);
    }

    /**
     * Handle shutdown
     */
    terminate() {
        logger.progress('Coinbase exchange closing down');
        super.terminate();
    }

    /**
     * Given a symbol (like BTC-USD), figure out the pair (btc & usd)
     * @param symbol
     * @returns {*}
     */
    splitSymbol(symbol) {
        const regex = /^([a-z]+)-([a-z]+)/;
        const m = regex.exec(symbol.toLowerCase());
        if (m) {
            return { asset: m[1], currency: m[2] };
        }

        return { asset: 'btc', currency: 'usd' };
    }
}

module.exports = Coinbase;
