const assert = require('chai').assert;
const sinon = require('sinon');
const Bitfinex = require('../src/exchanges/bitfinex');
const Deribit = require('../src/exchanges/deribit');

describe('Position Size validation', async () => {
    it('can work with spot position sizes on Bitfinex - blank postiion', async () => {
        const exchange = new Bitfinex({});

        // Settings
        const position = '';
        const side = 'buy';
        const amount = '1';

        const expected = { side: 'buy', amount: { value: 1, units: '' } };

        // Try and buy 2 when there is enough to do that.
        const price = await exchange.positionToAmount('BTCUSD', position, side, amount);
        assert.deepEqual(price, expected);
    });

    it('can work with spot position sizes on Bitfinex - bigger position, so buy', async () => {
        const exchange = new Bitfinex({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1',
                available: '1',
            },
        ]
        ;
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(wallet));

        // Settings
        const position = '5';
        const side = 'buy';
        const amount = '1';

        const expected = { side: 'buy', amount: { value: 4, units: '' } };

        // Try and buy 2 when there is enough to do that.
        const price = await exchange.positionToAmount('BTCUSD', position, side, amount);
        assert.deepEqual(price, expected);
    });

    it('can work with spot position sizes on Bitfinex - smaller position, so sell', async () => {
        const exchange = new Bitfinex({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1',
                available: '1',
            },
        ]
        ;
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(wallet));

        // Settings
        const position = '0';
        const side = 'buy';
        const amount = '1';

        const expected = { side: 'sell', amount: { value: 1, units: '' } };

        // Try and buy 2 when there is enough to do that.
        const price = await exchange.positionToAmount('BTCUSD', position, side, amount);
        assert.deepEqual(price, expected);
    });

    it('can calculate scaled order size - sell 1btc when 1btc available', async () => {
        const exchange = new Bitfinex({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            { type: 'exchange', currency: 'btc', amount: '1', available: '1' },
            { type: 'exchange', currency: 'usd', amount: '1000', available: '1000' },
        ];
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(wallet));

        const params = { side: 'sell',
            amount: { value: 1, units: '' },
            orderCount: 10,
            from: 10,
            to: 100,
            easing: 'linear' };

        // Try and buy 2 when there is enough to do that.
        const amount = await exchange.scaledOrderSize('BTCUSD', params);
        assert.equal(amount, 1);
    });

    it('can calculate scaled order size - sell 1btc when 0.8btc available', async () => {
        const exchange = new Bitfinex({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            { type: 'exchange', currency: 'btc', amount: '1', available: '0.8' },
            { type: 'exchange', currency: 'usd', amount: '1000', available: '1000' },
        ];
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(wallet));

        const params = { side: 'sell',
            amount: { value: 1, units: '' },
            orderCount: 10,
            from: 10,
            to: 100,
            easing: 'linear' };

        // Try and buy 2 when there is enough to do that.
        const amount = await exchange.scaledOrderSize('BTCUSD', params);
        assert.equal(amount, 0.8);
    });

    it('can calculate scaled order size - sell 0.005btc when it would result in orders too small', async () => {
        const exchange = new Bitfinex({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            { type: 'exchange', currency: 'btc', amount: '1', available: '0.8' },
            { type: 'exchange', currency: 'usd', amount: '1000', available: '1000' },
        ];
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(wallet));

        const params = { side: 'sell',
            amount: { value: 0.009, units: '' },
            orderCount: 10,
            from: 10,
            to: 100,
            easing: 'linear' };

        // Try and buy 2 when there is enough to do that.
        const amount = await exchange.scaledOrderSize('BTCUSD', params);
        assert.equal(amount, 0);
    });

    it('can calculate scaled order size - buy 1btc with enough funds to spare', async () => {
        const exchange = new Bitfinex({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            { type: 'exchange', currency: 'btc', amount: '1', available: '0.8' },
            { type: 'exchange', currency: 'usd', amount: '1000', available: '1000' },
        ];
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(wallet));

        const params = { side: 'buy',
            amount: { value: 1, units: '' },
            orderCount: 10,
            from: 500,
            to: 600,
            easing: 'linear' };

        // Try and buy 2 when there is enough to do that.
        const amount = await exchange.scaledOrderSize('BTCUSD', params);
        assert.equal(amount, 1);
    });

    it('can calculate scaled order size - buy 1btc without enough money', async () => {
        const exchange = new Bitfinex({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            { type: 'exchange', currency: 'btc', amount: '1', available: '0.8' },
            { type: 'exchange', currency: 'usd', amount: '1000', available: '300' },
        ];
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(wallet));

        const params = { side: 'buy',
            amount: { value: 1, units: '' },
            orderCount: 5,
            from: 500,
            to: 600,
            easing: 'linear' };

        // Try and buy 2 when there is enough to do that.
        const amount = await exchange.scaledOrderSize('BTCUSD', params);
        assert.equal(amount, 0.545454);
    });

    it('can work with position sizes on Deribit - no position', async () => {
        const exchange = new Deribit({});

        // Build a mock API to call
        class MockAPI { positions() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            {
                instrument: 'BTC-PERPETUAL',
                size: '1',
            },
        ];
        const mock = sinon.mock(api);
        mock.expects('positions').once().returns(Promise.resolve(wallet));

        // Settings
        const position = '';
        const side = 'buy';
        const amount = '1';

        const expected = { side: 'buy', amount: { value: 1, units: '' } };

        // Try and buy 2 when there is enough to do that.
        const price = await exchange.positionToAmount('BTCUSD', position, side, amount);
        assert.deepEqual(price, expected);
    });

    it('can work with position sizes on Deribit - position position', async () => {
        const exchange = new Deribit({});

        // Build a mock API to call
        class MockAPI { positions() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const wallet = [
            {
                instrument: 'BTC-PERPETUAL',
                size: '1',
            },
        ];
        const mock = sinon.mock(api);
        mock.expects('positions').once().returns(Promise.resolve(wallet));

        // Settings
        const position = '5';
        const side = 'buy';
        const amount = '1';

        const expected = { side: 'buy', amount: { value: 4, units: '' } };

        // Try and buy 2 when there is enough to do that.
        const price = await exchange.positionToAmount('BTC-PERPETUAL', position, side, amount);
        assert.deepEqual(price, expected);
    });
});
