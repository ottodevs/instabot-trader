const assert = require('chai').assert;
const sinon = require('sinon');
const ExchangeManager = require('../src/exchanges/manager');

describe('Exchange tests', () => {
    it('can see no commands in an empty message', () => {
        const manager = new ExchangeManager([]);
        const callback = sinon.spy();

        manager.commandBlocks('', callback);
        assert.isTrue(callback.notCalled);
    });

    it('can see no commands in plain message', () => {
        const manager = new ExchangeManager([]);
        const callback = sinon.spy();

        manager.commandBlocks('This is just a regular message, with no commands in it', callback);
        assert.isTrue(callback.notCalled);
    });


    it('can see a single command', () => {
        const manager = new ExchangeManager([]);
        const callback = sinon.spy();

        manager.commandBlocks('nothing important exchange(btc-thing) { command() } more stuff', callback);
        assert.isTrue(callback.calledOnce);
        assert.isTrue(callback.firstCall.calledWith('exchange', 'btc-thing', 'command()'));
    });

    it('can see a single command when nothing else', () => {
        const manager = new ExchangeManager([]);
        const callback = sinon.spy();

        manager.commandBlocks('exchange(btc-thing) { command() }', callback);
        assert.isTrue(callback.calledOnce);
        assert.isTrue(callback.firstCall.calledWith('exchange', 'btc-thing', 'command()'));
    });

    it('can see a single command when nothing else', () => {
        const manager = new ExchangeManager([]);
        const callback = sinon.spy();

        manager.commandBlocks('exchange(btc-thing) { command() } other(ethbtc) { wait() }', callback);
        assert.isTrue(callback.calledTwice);
        assert.isTrue(callback.firstCall.calledWith('exchange', 'btc-thing', 'command()'));
        assert.isTrue(callback.secondCall.calledWith('other', 'ethbtc', 'wait()'));
    });

    it('can not see badly formatted commands', () => {
        const manager = new ExchangeManager([]);
        const callback = sinon.spy();

        manager.commandBlocks('exchange() { }', callback);
        assert.isFalse(callback.called);
    });


    it('can avoid blocks with no commands in them', () => {
        const manager = new ExchangeManager([]);
        const callback = sinon.spy();

        manager.commandBlocks('exchange(BTCUSD) {      }', callback);
        assert.isFalse(callback.called);
    });
});
