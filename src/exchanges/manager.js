const async = require('async');
const uuid = require('uuid/v4');
const log = require('../common/logger');
const Fregex = require('../common/functional-regex');
const notifier = require('../notifications/notifier');

const logger = log.logger;


/**
 * The exchange manager
 */
class ExchangeManager {
    /**
     * ctor
     */
    constructor(exchanges) {
        // Nothing is opened at this point
        this.opened = [];

        // But we do know about all supported exchanges...
        this.exchanges = exchanges || [];
    }

    /**
     * Helper to find an exchange that we already have opened
     * @param name
     * @param credentials
     * @returns {Exchange | undefined}
     */
    findOpened(name, credentials) {
        return this.opened.find(el => el.matches(name, credentials));
    }

    /**
     * Opens an exchange (creates it if we don't already have it)
     * @param name
     * @param credentials
     * @returns {*}
     */
    openExchange(name, credentials) {
        // Search the open exchanges to see if we have a match
        const exchange = this.findOpened(name, credentials);

        // If we found it, return it
        if (exchange) {
            exchange.addReference();
            return exchange;
        }

        // no match, so try and create a new instance with the details
        const match = this.exchanges.find(el => el.name === name);
        if (!match) return null;

        // Create a new instance of the exchange with the credentials given
        logger.progress(`Starting ${match.description}`);

        const newExchange = new match.class(credentials);
        this.opened.push(newExchange);

        // Let the exchange do anything it needs before it is used.
        newExchange.init();

        return newExchange;
    }

    /**
     * Close an exchange that we no longer need
     * @param exchange
     */
    closeExchange(exchange) {
        if (!exchange) { return; }

        const ex = this.findOpened(exchange.name, exchange.credentials);
        if (!ex) { return; }

        if (exchange.removeReference() <= 0) {
            // no more references, so we can remove this from the open exchange list
            exchange.terminate();
            this.opened = this.opened.filter(item => item !== exchange);
        }
    }

    /**
     * Execute a command on an exchange
     * @param exchange
     * @param symbol
     * @param name
     * @param params
     * @param session
     * @returns {*}
     */
    executeCommand(exchange, symbol, name, params, session) {
        return exchange.executeCommand(symbol, name, params, session);
    }

    /**
     * Executes a list of commands on an exchange
     * @param exchange
     * @param symbol
     * @param commands
     * @returns {Promise<any>}
     */
    executeCommandSequence(exchange, symbol, commands) {
        return new Promise((resolve, reject) => {
            // no symbol or no commands, then just do nothing
            if (symbol === '' || commands === '') {
                return resolve();
            }

            const session = uuid();

            logger.notice('\n================================');
            logger.notice(`Exchange : ^C${exchange.name}`);
            logger.notice(`Symbol   : ^C${symbol.toUpperCase()}`);
            logger.notice(`Session  : ^C${session}`);
            logger.notice(`Commands : ^C${commands.trim().replace(/;\s*/gm, '; ')}`);
            logger.notice('================================\n');

            // Break up the commands into actions, and execute them in series
            const actions = exchange.parseActions(commands);
            return async.eachSeries(actions, (action, next) => {
                this.executeCommand(exchange, symbol, action.name, action.params, session)
                    .then(() => next())
                    .catch((err) => {
                        logger.error(`${action.name} FAILED: ${err}`);
                        next();
                    });
            }, err => ((err) ? reject(err) : resolve()));
        });
    }

    /**
     * Decide if we need to send out an alert or not. Send it if we do...
     * @param msg
     */
    static handleAlerts(msg) {
        // We'll send out an alert if we find {!} in the message
        const notifyRegex = /\{!\}/;
        if (notifyRegex.exec(msg)) {
            // But first we'll remove all the command blocks from the message...
            const toSend = msg.replace(/([a-z]+)\(([\s\S]*?)\)\s*{([\s\S]*?)}/gi, '')
                .replace(/\{!\}/, '')
                .replace(/\s+/ug, ' ')
                .trim();

            if (toSend !== '') {
                notifier.send(toSend);
            }
        }
    }

    /**
     * Split out the command blocks from a message
     * @param msg
     * @param cb
     */
    commandBlocks(msg, cb) {
        const regex = new Fregex();
        regex.forEach(/([a-z]+)\(([\s\S]*?)\)\s*{([\s\S]*?)}/gi, msg, (m) => {
            // Extract the parts
            const exchangeName = m[1].trim().toLowerCase();
            const symbol = m[2].trim();
            const actions = m[3].trim();

            // Check we've got something to work with
            if (exchangeName !== '' && symbol !== '' && actions !== '') {
                cb(exchangeName, symbol, actions);
            }
        });
    }

    /**
     * Given a message from TradingView, process all the calls in it
     * @param msg
     * @param credentials
     */
    executeMessage(msg, credentials) {
        // report on the symbol being traded
        const now = new Date();
        logger.notice('\n================================');
        logger.notice('Message Received');
        logger.notice(`${now}`);
        logger.notice(`Message : \n^C${msg.trim()}`);
        logger.notice('================================\n');

        // regex to break the message up into the bits we need
        const all = [Promise.resolve()];
        this.commandBlocks(msg, (exchangeName, symbol, actions) => {
            const exchangeCredentials = credentials.find(item => item.name === exchangeName);
            if (exchangeCredentials) {
                const exchange = this.openExchange(exchangeName, exchangeCredentials);
                if (exchange) {
                    all.push(this.executeCommandSequence(exchange, symbol, actions)
                        .catch((err) => {
                            logger.error(`Command sequence terminated - ${err}`);
                        }).finally(() => setTimeout(() => this.closeExchange(exchange), 500)));
                } else {
                    logger.error(`Exchange '${exchangeName}' is not supported`);
                }
            } else {
                logger.error(`No credentials for '${exchangeName}'. Skipping`);
            }
        });

        // Send out a notification if one was wanted...
        ExchangeManager.handleAlerts(msg);

        return all;
    }
}

module.exports = ExchangeManager;
