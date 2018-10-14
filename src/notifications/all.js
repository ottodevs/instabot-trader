const SmsNotifier = require('./sms');
const SlackNotifier = require('./slack');
const TelegramNotifier = require('./telegram');

// A list of all the supported exchanges
module.exports = [
    {
        name: 'sms',
        driver: new SmsNotifier(),
    },
    {
        name: 'slack',
        driver: new SlackNotifier(),
    },
    {
        name: 'telegram',
        driver: new TelegramNotifier(),
    },
];
