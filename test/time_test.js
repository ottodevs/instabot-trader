const assert = require('chai').assert;
const Exchange = require('../src/exchanges/exchange');

describe('Time tests', () => {
    it('can handle no arguments', () => {
        const exchange = new Exchange({});

        const seconds = exchange.timeToSeconds('', 10);
        assert.equal(seconds, 10);
    });

    it('can convert plain numbers', () => {
        const exchange = new Exchange({});

        const seconds = exchange.timeToSeconds('42', 10);
        assert.equal(seconds, 42);
    });

    it('can convert seconds numbers', () => {
        const exchange = new Exchange({});

        const seconds = exchange.timeToSeconds('42s', 10);
        assert.equal(seconds, 42);
    });

    it('can convert minutes to seconds', () => {
        const exchange = new Exchange({});

        const seconds = exchange.timeToSeconds('10m', 10);
        assert.equal(seconds, 600);
    });

    it('can convert hours to seconds', () => {
        const exchange = new Exchange({});

        const seconds = exchange.timeToSeconds('2h', 10);
        assert.equal(seconds, 7200);
    });
});
