const config = require('config');
const twilio = require('twilio');
const log = require('../common/logger');

/**
 * SMS Notifier
 */
class SmsNotifier {
    /**
     * Find the API keys from the config
     */
    constructor() {
        this.key = config.get('sms.twilio.key');
        this.secret = config.get('sms.twilio.secret');
        this.from = config.get('sms.from');
        this.to = config.get('sms.to');
    }

    /**
     * Send a message
     * @param msg
     */
    send(msg) {
        // No keys - do nothing
        if (!this.key || !this.secret || this.key === '' || this.secret === '') {
            log.logger.error("Can't send SMS - need Twilio credentials");
            return;
        }

        log.logger.results('Sending SMS Alert:');
        log.logger.results(`${msg}`);
        const client = twilio(this.key, this.secret);
        client.messages.create({
            to: this.to,
            from: this.from,
            body: msg,
        });
    }

    init() {}
    setExchangeManager() {}
}

module.exports = SmsNotifier;
