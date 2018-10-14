const config = require('config');
const Slack = require('slack-node');
const logger = require('../common/logger').logger;

/**
 * SMS Notifier
 */
class SlackNotifier {
    /**
     * Find the API keys from the config
     */
    constructor() {
        this.webhook = config.get('slack.webhook');
    }

    /**
     * Send a message
     * @param msg
     * @param options
     */
    send(msg, options) {
        // If not configured, ignore
        if (this.webhook === '') {
            return;
        }

        // Build the message
        const slackMessage = {
            text: msg,
        };

        if (options && options.title && options.title !== '') {
            slackMessage.attachments = [
                {
                    fallback: options.title,
                    color: options.color,
                    title: options.title,
                    text: options.text,
                    footer: options.footer,
                },
            ];
        }

        // send a message
        const slack = new Slack();
        slack.setWebhook(this.webhook);
        slack.webhook(slackMessage, (err, res) => {
            if (err) {
                logger.error('Failed to send Slack notification');
                logger.error(err);
            }
        });
    }

    init() {}
    setExchangeManager() {}
}

module.exports = SlackNotifier;
