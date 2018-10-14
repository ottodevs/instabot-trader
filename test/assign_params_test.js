const assert = require('chai').assert;
const Exchange = require('../src/exchanges/exchange');

describe('Assign Params tests', () => {
    it('can handle no arguments', () => {
        const exchange = new Exchange({});

        const defaults = { duration: '10s' };
        const params = exchange.assignParams(defaults, []);
        assert.deepEqual(params, defaults);
    });

    it('can handle an indexed value', () => {
        const exchange = new Exchange({});

        const defaults = { duration: '10s' };
        const args = [
            { name: '', value: '12', index: 0 },
        ];
        const params = exchange.assignParams(defaults, args);
        assert.deepEqual(params, { duration: '12' });
    });

    it('can handle an named value', () => {
        const exchange = new Exchange({});

        const defaults = { duration: '10s' };
        const args = [
            { name: 'duration', value: '12', index: 0 },
        ];
        const params = exchange.assignParams(defaults, args);
        assert.deepEqual(params, { duration: '12' });
    });

    it('can handle an named value out of order', () => {
        const exchange = new Exchange({});

        const defaults = { duration: '10s' };
        const args = [
            { name: '', value: '23', index: 0 },
            { name: 'duration', value: '12', index: 1 },
        ];
        const params = exchange.assignParams(defaults, args);
        assert.deepEqual(params, { duration: '12' });
    });

    it('can handle an named complex combo', () => {
        const exchange = new Exchange({});

        const defaults = {
            duration: '10s',
            example: '',
            test: 'hello'
        };
        const args = [
            { name: '', value: '23', index: 0 },
            { name: 'test', value: '12', index: 1 },
            { name: 'example', value: 'fish', index: 2 },
        ];
        const params = exchange.assignParams(defaults, args);
        assert.deepEqual(params, { duration: '23', example: 'fish', test: '12' });
    });
});
