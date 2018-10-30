const logger = require('../../common/logger').logger;
const notifier = require('../../notifications/notifier');


/**
 * Send a message to slack / telegram or SMS
 */
module.exports = (context, args) => {
    const { ex = {} } = context;

    const p = ex.assignParams({
        msg: 'Message from Instabot Trader',
        title: '',
        color: 'good',
        text: ':moneybag:',
        footer: 'from instabot trader - not financial advice.',
        who: 'default',
    }, args);

    logger.progress(`NOTIFICATION MESSAGE - ${ex.name}`);
    logger.progress(p);

    notifier.send(p.msg, p, p.who.toLowerCase());
    return Promise.resolve();
};
