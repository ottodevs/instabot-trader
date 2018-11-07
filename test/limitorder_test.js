const assert = require('chai').assert;
const sinon = require('sinon');
const Exchange = require('../src/exchanges/exchange');

describe('limit Orders', async () => {
    afterEach(() => {
        // Restore the default sandbox here
        sinon.restore();
    });

    it('can rejects orders with an invalid side', async () => {
        try {
            const exchange = new Exchange({});
            const args = [{ name: 'side', value: 'wrong', index: 0 }];
            await exchange.limitOrder('BTCUSD', args, 'test-session');
            assert.isOk(false, 'Should not get here');
        } catch (err) {
            assert.deepEqual(err, new Error('side must be buy or sell'));
        }
    });

    it('can place no order when order size is zero', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI { limitOrder() {}}
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const mock = sinon.mock(api);

        // arguments
        const args = [
            { name: 'side', value: 'buy', index: 0 },
            { name: 'offset', value: '100', index: 1 },
            { name: 'amount', value: '0', index: 2 },
        ];

        const expected = { order: null };

        // Try and buy 2 when there is enough to do that.
        const order = await exchange.commands.limitOrder({ ex: exchange, symbol: 'BTCUSD', session: 'test-session' }, args);
        sinon.assert.notCalled(mock.expects('limitOrder'));
        assert.deepEqual(order, expected);
    });

    function mockTicker(mock) {
        // Set up the ticker response
        return mock.expects('ticker').once().returns(Promise.resolve({
            mid: '6550',
            bid: '6540',
            ask: '6560',
            last_price: '6545',
        }));
    }

    function mockWalletBalances(mock, btc = '1.5', usd = '12000', btcAvailable = '1.5', usdAvailable = '12000') {
        // set up the wallet balance response
        mock.expects('walletBalances').once().returns(Promise.resolve([
            {
                type: 'exchange',
                currency: 'btc',
                amount: btc,
                available: btcAvailable,
            },
            {
                type: 'exchange',
                currency: 'usd',
                amount: usd,
                available: usdAvailable,
            },
        ]));
    }

    it('can place an order, with funds available', async () => {
        const exchange = new Exchange({});

        // Build a mock API to call
        class MockAPI {
            ticker() {}
            walletBalances() {}
            limitOrder() {}
        }
        const api = new MockAPI();
        exchange.api = api;

        // Mock out the function for testing
        const mock = sinon.mock(api);
        const expected = { order: 'worked' };

        // Set up the ticker response
        mockTicker(mock);
        mockWalletBalances(mock);

        // set up the limit order response
        mock.expects('limitOrder').once().withArgs('BTCUSD', 1, 6440, 'buy', false).returns(Promise.resolve(expected));

        // arguments
        const args = [
            { name: 'side', value: 'buy', index: 0 },
            { name: 'offset', value: '100', index: 1 },
            { name: 'amount', value: '1', index: 2 },
        ];

        // Try and buy 2 when there is enough to do that.
        const order = await exchange.commands.limitOrder({ ex: exchange, symbol: 'BTCUSD', session: 'test-session' }, args);
        sinon.assert.notCalled(mock.expects('limitOrder'));
        assert.deepEqual(order.order, expected);
        assert.equal(order.price, 6440);
        assert.equal(order.side, 'buy');
        assert.equal(order.amount, 1);
    });
});
