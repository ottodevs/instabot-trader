const Bitfinex = require('./bitfinex');
const Deribit = require('./deribit');
const Coinbase = require('./coinbase');

// A list of all the supported exchanges
module.exports = [
    {
        name: 'bitfinex',
        description: 'Bitfinex spot exchange',
        class: Bitfinex,
    },
    {
        name: 'deribit',
        description: 'Deribit',
        class: Deribit,
    },
    {
        name: 'coinbase',
        description: 'Coinbase Pro',
        class: Coinbase,
    },
];
