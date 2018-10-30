const config = require('config');
const Telegraf = require('telegraf');
const logger = require('../common/logger').logger;


/**
 * Telegram Notifier
 */
class TelegramNotifier {
    /**
     * Find the API keys from the config
     */
    constructor() {
        this.telegramBotToken = config.get('telegram.botToken');
        this.safeUser = config.get('telegram.safeUser');
        this.client = null;
        this.exchangeManager = null;
        this.lastChatId = null;
    }

    /**
     * Called at startup - use this to start listening
     */
    init() {
        // Kick off the telegram bot, so it is listening for messages
        this.startTelegramBot();
    }

    /**
     * Give us access to the exchange manager, so we can route messages from the bot to the exchange
     * @param manager
     */
    setExchangeManager(manager) {
        this.exchangeManager = manager;
    }

    /**
     * Send a notification to Telegram
     * @param msg
     */
    send(msg) {
        // Can only do this if we are in a chat.
        if (!this.lastChatId) {
            logger.error('Could not send notification to Telegram as not in a chat');
            return;
        }

        // send the message
        this.client.telegram.sendMessage(this.lastChatId, msg);
    }

    /**
     * Determine if the user that's just contacted is 'safe'
     * ie, are they in the whitelist
     * @param userId
     * @returns {boolean}
     */
    isSafeUser(userId) {
        // no restrictions
        if (!this.safeUser || this.safeUser === '' || this.safeUser === 0) {
            return true;
        }

        if (this.safeUser === userId) {
            return true;
        }

        return false;
    }

    /**
     * Start the telegram bot if we have a token
     */
    startTelegramBot() {
        if (!this.telegramBotToken || this.telegramBotToken === '') {
            return;
        }

        // Set up a telegram bot too...
        const bot = new Telegraf(this.telegramBotToken);
        this.client = bot;

        // Handle chats starting
        bot.start((ctx) => {
            if (this.isSafeUser(ctx.message.from.id)) {
                this.lastChatId = ctx.message.chat.id;
            }
            logger.progress(`Chat started on Telegram. Chat ID: ${ctx.message.chat.id}. User Id: ${ctx.message.from.id}`);
            ctx.reply('Instabot Trader 🤖 is at your disposal... /help for more...');
        });

        // Handle requests for help
        bot.help(ctx => ctx.reply(
            'Send me a message to execute trades or send alerts...\n' +
            'Full Docs: [https://instabot42.github.io/](https://instabot42.github.io/)\n' +
            'Message Format: [https://instabot42.github.io/#api-format](https://instabot42.github.io/#api-format)\n' +
            'Command Reference: [https://instabot42.github.io/#api-Command_Reference](https://instabot42.github.io/#api-Command_Reference)\n\n' +
            '*Example Message*\n' +
            '```\n' +
            'bitfinex(BTCUSD) { balance(); }\n' +
            '```\n\n' +
            '`/help` - This message\n' +
            '`/list` - List all the shortcuts defined in your config.\n' +
            '`/shortcut name` - execute a message defined in your config/local.json called name', {parse_mode: 'Markdown'}));

        // If someone sends us a sticker...
        bot.on('sticker', ctx => setTimeout(() => ctx.reply('👍🖥💰📈'), 1000));

        bot.command('shortcut', async (ctx) => {
            if (this.isSafeUser(ctx.message.from.id) && this.exchangeManager) {
                this.lastChatId = ctx.message.chat.id;
                const regex = /\/shortcut\s+(.*)/i;
                const m = regex.exec(ctx.message.text);
                if (m !== null) {
                    const name = m[1];
                    logger.progress(`Running shortcut from Telegram: ${name}`);

                    const shortcuts = config.get('telegram.shortcuts');
                    const match = shortcuts.find(item => item.name === name);
                    if (match) {
                        // execute the message and respond when everything is done
                        await Promise.all(this.exchangeManager.executeMessage(match.message, config.get('credentials')));
                        ctx.reply(`Just finished working on\n\`${match.message}\`\n🤞`, {parse_mode: 'Markdown'});
                    }
                }
            }
        });

        // Handle the /list command
        bot.command('list', async (ctx) => {
            if (this.isSafeUser(ctx.message.from.id)) {
                this.lastChatId = ctx.message.chat.id;
                logger.progress('Showing list of shortcuts in Telegram chat');
                const shortcuts = config.get('telegram.shortcuts');
                const msg = shortcuts.reduce((fullMsg, item) => `${fullMsg}\n*${item.name}* - ${item.message}`, 'Found the following shortcuts...');
                ctx.reply(msg, {parse_mode: 'Markdown'});
            }
        });

        // Handle an actual message
        bot.on('message', async (ctx) => {
            if (this.isSafeUser(ctx.message.from.id) && this.exchangeManager) {
                this.lastChatId = ctx.message.chat.id;
                logger.progress('Generic message from Telegram chat');
                ctx.reply("OK. I'll try and deal with that. I'll let you know when it's done... 👍");

                // execute the message and respond when everything is done
                await Promise.all(this.exchangeManager.executeMessage(ctx.message.text, config.get('credentials')));

                // let them know we are done
                ctx.reply(`Just finished working on\n\`${ctx.message.text}\`\n🤞`, {parse_mode: 'Markdown'});
            }
        });

        // Handle any errors
        bot.catch((err) => {
            logger.error('Telegram Bot has seen an error');
            logger.error(err);
        });

        // Start listening
        bot.startPolling();
        logger.results('\nTelegram bot is listening for messages...\n');
    }
}

module.exports = TelegramNotifier;
