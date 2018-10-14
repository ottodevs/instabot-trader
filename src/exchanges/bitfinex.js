const log = require('../common/logger');
const Exchange = require('./exchange');
const BitfinexApiv1 = require('../apis/bitfinexv1');

const logger = log.logger;


/**
 * Bitfinex version of the exchange
 */
class Bitfinex extends Exchange {
    /**
     * set up the supported commands and API
     * @param credentials
     */
    constructor(credentials) {
        super(credentials);
        this.name = 'bitfinex';

        // Add all the commands we support
        this.addCommands(['limitOrder', 'marketOrder', 'cancelOrders']);

        // start up any sockets or create API handlers here.
        this.api = new BitfinexApiv1(credentials.key, credentials.secret);
    }

    /**
     * Handle shutdown
     */
    terminate() {
        logger.progress('Bitfinex exchange closing down');
        super.terminate();
    }
}

module.exports = Bitfinex;
