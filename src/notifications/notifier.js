const config = require('config');
const logger = require('../common/logger').logger;

/**
 * A system for sending notifications
 */
class Notifier {
    /**
     * set up the channels and default channel
     */
    constructor() {
        this.channels = [];
        this.default = config.get('notifications.default');
    }

    /**
     * Add a channel
     * @param name
     * @param driver
     */
    addChannel(name, driver) {
        logger.results(`Added Notification Channel: ${name}`);
        this.channels.push({
            name,
            driver,
        });

        // give the notifier a chance to set up
        driver.init();
    }

    /**
     * Send a message to a channel
     * @param msg
     * @param extra
     * @param where
     */
    send(msg, extra, where) {
        const target = (where === undefined || where === 'default') ? this.default : [where];
        const options = extra || {};
        const drivers = this.channels.filter(item => target.find(t => t === item.name));
        drivers.forEach(n => n.driver.send(msg, options));
    }

    /**
     * Tell the notifiers about the exchange manager (so they can issue commands)
     * @param manager
     */
    setExchangeManager(manager) {
        this.channels.forEach(n => n.driver.setExchangeManager(manager));
    }
}


module.exports = new Notifier();
