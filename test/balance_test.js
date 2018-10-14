const assert = require('chai').assert;
const sinon = require('sinon');
const Exchange = require('../src/exchanges/exchange');

describe('Order Size Calculations', () => {
    it('can get the current price', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI { ticker() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const expected = {
            mid: '6588.45',
            bid: '6588.4',
            ask: '6588.5',
            last_price: '6588.4',
        };
        const mock = sinon.mock(api);
        mock.expects('ticker').once().returns(Promise.resolve(expected));

        // call it
        const orderBook = await exchange.ticker('BTCUSD', [], 'test');
        assert.equal(orderBook, expected);
    });

    it('can get the current wallet balance', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const expected = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1.2',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '0.0',
                available: '0.0',
            },
        ]
        ;
        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(expected));

        // call it
        const orderBook = await exchange.accountWalletBalances('BTCUSD');
        assert.deepEqual(orderBook, expected);
    });

    it('can filter the balance results', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI { walletBalances() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const response = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1.2',
            },
            {
                type: 'exchange',
                currency: 'eur',
                amount: '0.0',
                available: '0.0',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '0.0',
                available: '0.0',
            },
            {
                type: 'exchange',
                currency: 'eth',
                amount: '0.0',
                available: '0.0',
            },
            {
                type: 'exchange',
                currency: 'ltc',
                amount: '0.0',
                available: '0.0',
            },
        ];

        const expected = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1.2',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '0.0',
                available: '0.0',
            },
        ];

        const mock = sinon.mock(api);
        mock.expects('walletBalances').once().returns(Promise.resolve(response));

        // call it
        const orderBook = await exchange.accountWalletBalances('BTCUSD');
        assert.deepEqual(orderBook, expected);
    });

    it('can go from offset to absolute price - buying', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI { ticker() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const expected = {
            mid: '6600',
            bid: '6590',
            ask: '6610',
            last_price: '6595',
        };
        const mock = sinon.mock(api);
        mock.expects('ticker').once().returns(Promise.resolve(expected));

        // Expect 150 below bid
        const price = await exchange.offsetToAbsolutePrice('BTCUSD', 'buy', '150');
        assert.equal(price, 6440);
    });

    it('can go from offset to absolute price - selling', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI { ticker() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const expected = {
            mid: '6600',
            bid: '6590',
            ask: '6610',
            last_price: '6595',
        };
        const mock = sinon.mock(api);
        mock.expects('ticker').once().returns(Promise.resolve(expected));

        // Expect 150 above ask
        const price = await exchange.offsetToAbsolutePrice('BTCUSD', 'sell', '150');
        assert.equal(price, 6760);
    });

    it('can go from offset to absolute price - using percentage', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI { ticker() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const expected = {
            mid: '6600',
            bid: '6590',
            ask: '6610',
            last_price: '6595',
        };
        const mock = sinon.mock(api);
        mock.expects('ticker').once().returns(Promise.resolve(expected));

        // Expect 10% below 6590 (659 below)
        const price = await exchange.offsetToAbsolutePrice('BTCUSD', 'buy', '10%');
        assert.equal(price, 5931);
    });

    it('can accept absolute prices', async () => {
        const exchange = new Exchange({});

        // Expect 10% below 6590 (659 below)
        assert.equal(await exchange.offsetToAbsolutePrice('BTCUSD', 'buy', '@1234.56'), 1234.56);
        assert.equal(await exchange.offsetToAbsolutePrice('BTCUSD', 'buy', '@6250'), 6250);
        assert.equal(await exchange.offsetToAbsolutePrice('BTCUSD', 'buy', '  @6250  '), 6250);
        assert.equal(await exchange.offsetToAbsolutePrice('BTCUSD', 'buy', '@62.12345678'), 62.1234);
    });

    it('can calculate order price - inside budget', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '12000.0',
                available: '12000.0',
            },
        ];

        const expected = {
            total: 3.5,
            available: 2,
            isAllAvailable: true,
            orderSize: 2,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('2');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });

    it('can calculate order price - money to spare', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '12000.0',
                available: '12000.0',
            },
        ];

        const expected = {
            total: 3.5,
            available: 2,
            isAllAvailable: false,
            orderSize: 1,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('1');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });

    it('can calculate order price - capped by available', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '12000.0',
                available: '6000.0',
            },
        ];

        const expected = {
            total: 3.5,
            available: 1,
            isAllAvailable: true,
            orderSize: 1,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('2');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });

    it('can calculate order price - no funds to spend', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '0.0',
                available: '0.0',
            },
        ];

        const expected = {
            total: 1.5,
            available: 0,
            isAllAvailable: true,
            orderSize: 0,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('2');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });

    it('can calculate order price - units in btc', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '12000.0',
                available: '12000.0',
            },
        ];

        const expected = {
            total: 3.5,
            available: 2,
            isAllAvailable: false,
            orderSize: 1,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('1btc');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });

    it('can calculate order price - units in usd', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '12000.0',
                available: '12000.0',
            },
        ];

        const expected = {
            total: 3.5,
            available: 2,
            isAllAvailable: false,
            orderSize: 0.5,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('3000usd');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });

    it('can calculate order price - units as a percentage', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '15000.0',
                available: '12000.0',
            },
        ];

        const expected = {
            total: 4,
            available: 2,
            isAllAvailable: false,
            orderSize: 0.4,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('10%');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });

    it('can calculate order price - units as a percentage of available', async () => {
        const exchange = new Exchange({});
        const balance = [
            {
                type: 'exchange',
                currency: 'btc',
                amount: '1.5',
                available: '1',
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: '15000.0',
                available: '12000.0',
            },
        ];

        const expected = {
            total: 4,
            available: 2,
            isAllAvailable: false,
            orderSize: 0.2,
        };

        // Try and buy 2 when there is enough to do that.
        const amount = exchange.parseQuantity('10%%');
        const price = exchange.calcOrderSize('BTCUSD', 'buy', amount, balance, 6000);
        assert.deepEqual(price, expected);
    });
});
