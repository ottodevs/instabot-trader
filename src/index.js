const express = require('express');
const bodyParser = require('body-parser');
const config = require('config');
const log = require('./common/logger');
const ExchangeManager = require('./exchanges/manager');
const allExchanges = require('./exchanges/all');
const notifier = require('./notifications/notifier');
const allNotifiers = require('./notifications/all');

// Set up the logger
const logger = log.logger;
logger.setLevel(config.get('server.logLevel'));

const startTime = new Date();

logger.bright('\n');
logger.bright('=================================================\n');
logger.bright('  Instabot Trader bot starting  🤖  🚀  🌔  🏎️ \n');
logger.bright('  Tip BTC: 39vBjyAu65vYEd7thnW75V7eULTcz7wgxV\n');
logger.bright('=================================================\n');
logger.results(`\nStarted at ${startTime}\n`);

// Set up the notifiers
allNotifiers.forEach(item => notifier.addChannel(item.name, item.driver));
if (config.get('notifications.alertOnStartup')) {
    notifier.send(`Instabot Trader starting up at ${startTime}.`);
}

// Prepare Express
const app = express();
const url = config.get('server.url');
const port = parseInt(config.get('server.port'), 10);

// middleware to decode the query params in the request
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: false }));

// Create the exchange manager
const manager = new ExchangeManager(allExchanges);
notifier.setExchangeManager(manager);

app.post(url, (req, res) => {
    logger.notice('HTTP POST request received...');

    // Get the commands from the SMS
    const message = req.body.subject || req.body.Body || req.body.message || '';
    if (message === '') {
        logger.error('Request did not include a message.\nPOST messages in a variable called subject, Body or message.');
        logger.error(req.body);
        return res.sendStatus(400);
    }

    // Try and process them
    manager.executeMessage(message, config.get('credentials'));

    // Respond to the request
    return res.send(message);
});


/**
 * Start the server listening for incoming HTTP requests
 */
app.listen(port, (err) => {
    if (err) {
        logger.error(`Failed to start server on port ${port}`);
        logger.error(err);
    } else {
        logger.results('\nServer is listening for commands at');
        logger.results(`http://localhost:${port}${url}\n`);
    }
}).on('error', (err) => {
    logger.error('Error starting server');
    logger.error(err);
    if (err.errno === 'EADDRINUSE') {
        logger.error(`The port ${port} is already in use.`);
    }
});
