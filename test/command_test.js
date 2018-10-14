const assert = require('chai').assert;
const Exchange = require('../src/exchanges/exchange');

describe('Command Parse arguments', () => {
    it('can handle no arguments', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('');
        assert.isArray(args);
        assert.lengthOf(args, 0);
    });

    it('can handle no arguments but whitespace', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('      ');
        assert.isArray(args);
        assert.lengthOf(args, 0);
    });

    it('can extract a single value', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('12');
        assert.deepEqual(args, [{ name: '', value: '12', index: 0 }]);
    });

    it('can extract a single value string', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('hello world');
        assert.deepEqual(args, [{ name: '', value: 'hello world', index: 0 }]);
    });

    it('can extract a couple of comma separated values', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('hello  , world');
        assert.deepEqual(args, [
            { name: '', value: 'hello', index: 0 },
            { name: '', value: 'world', index: 1 },
        ]);
    });

    it('can extract a named argument', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('bob = 42');
        assert.deepEqual(args, [
            { name: 'bob', value: '42', index: 0 },
        ]);
    });

    it('can extract a quoted argument', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('12, "Buy, buy, buy", 42');
        assert.deepEqual(args, [
            { name: '', value: '12', index: 0 },
            { name: '', value: 'Buy, buy, buy', index: 1 },
            { name: '', value: '42', index: 2 },
        ]);
    });

    it('can extract a argument that has a quote in it', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('12, "Buy, 42');
        assert.deepEqual(args, [
            { name: '', value: '12', index: 0 },
            { name: '', value: '"Buy', index: 1 },
            { name: '', value: '42', index: 2 },
        ]);
    });

    it('can extract a named argument with quotes', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('bob="quoted args 12"');
        assert.deepEqual(args, [
            { name: 'bob', value: 'quoted args 12', index: 0 },
        ]);
    });

    it('can extract a mixture of named and unnamed args', () => {
        const exchange = new Exchange({});

        const args = exchange.parseArguments('12, bob="quoted args 12", fish, "more fish", end=42');
        assert.deepEqual(args, [
            { name: '', value: '12', index: 0 },
            { name: 'bob', value: 'quoted args 12', index: 1 },
            { name: '', value: 'fish', index: 2 },
            { name: '', value: 'more fish', index: 3 },
            { name: 'end', value: '42', index: 4 },
        ]);
    });
});


describe('Command Parse Actions', () => {
    it('can handle no actions', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('');
        assert.isArray(args);
        assert.lengthOf(args, 0);
    });

    it('can handle just whitespace', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('           ');
        assert.isArray(args);
        assert.lengthOf(args, 0);
    });

    it('can ignore stuff that does not look like a command', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('    whatevars       ');
        assert.isArray(args);
        assert.lengthOf(args, 0);
    });

    it('can find a simple command', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('wait()');
        assert.deepEqual(args, [
            { name: 'wait', params: [] },
        ]);
    });

    it('can find a simple command with semi-colon', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('wait();');
        assert.deepEqual(args, [
            { name: 'wait', params: [] },
        ]);
    });

    it('can find a simple command with loads of semi-colons', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions(';;;;wait();;;;');
        assert.deepEqual(args, [
            { name: 'wait', params: [] },
        ]);
    });

    it('can find two commands', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('wait();SomeMore();');
        assert.deepEqual(args, [
            { name: 'wait', params: [] },
            { name: 'SomeMore', params: [] },
        ]);
    });

    it('can find two commands without semi-colons', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('wait()SomeMore()');
        assert.deepEqual(args, [
            { name: 'wait', params: [] },
            { name: 'SomeMore', params: [] },
        ]);
    });

    it('can find two commands one with arguments', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('wait(12); SomeMore()');
        assert.deepEqual(args, [
            { name: 'wait',
                params: [
                    { index: 0, name: '', value: '12' },
                ] },
            { name: 'SomeMore', params: [] },
        ]);
    });

    it('can find two commands with arguments', () => {
        const exchange = new Exchange({});

        const args = exchange.parseActions('wait(12, 42, hello world); SomeMore(5, head=body, fish)');
        assert.deepEqual(args, [
            { name: 'wait',
                params: [
                    { index: 0, name: '', value: '12' },
                    { index: 1, name: '', value: '42' },
                    { index: 2, name: '', value: 'hello world' },
                ] },
            { name: 'SomeMore',
                params: [
                    { index: 0, name: '', value: '5' },
                    { index: 1, name: 'head', value: 'body' },
                    { index: 2, name: '', value: 'fish' },
                ] },
        ]);
    });
});
