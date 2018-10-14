const assert = require('chai').assert;
const sinon = require('sinon');
const util = require('../src/common/util');


describe('Util lib', () => {
    it('can round to the nearest number', () => {
        assert.equal(util.round(1), 1);
        assert.equal(util.round(100.1), 100);
        assert.equal(util.round(100.2), 100);
        assert.equal(util.round(100.4), 100);
        assert.equal(util.round(100.5), 101);
        assert.equal(util.round(100.8), 101);
        assert.equal(util.round(100.999999), 101);
    });

    it('can round to the nearest number to 1 decimal place', () => {
        assert.equal(util.round(1, 1), 1);
        assert.equal(util.round(100.1, 1), 100.1);
        assert.equal(util.round(100.2, 1), 100.2);
        assert.equal(util.round(100.4, 1), 100.4);
        assert.equal(util.round(100.5, 1), 100.5);
        assert.equal(util.round(100.8, 1), 100.8);

        assert.equal(util.round(100.999999, 1), 101);
        assert.equal(util.round(1.123456789, 1), 1.1);
        assert.equal(util.round(1.4, 1), 1.4);
        assert.equal(util.round(1.44, 1), 1.4);
        assert.equal(util.round(1.45, 1), 1.5);
        assert.equal(util.round(1.48, 1), 1.5);
        assert.equal(util.round(1.5, 1), 1.5);
    });

    it('can round down', () => {
        assert.equal(util.roundDown(1), 1);
        assert.equal(util.roundDown(1, 1), 1);
        assert.equal(util.roundDown(1.2, 1), 1.2);
        assert.equal(util.roundDown(1.29, 1), 1.2);
        assert.equal(util.roundDown(1.999999, 0), 1);
        assert.equal(util.roundDown(1.999999, 1), 1.9);
        assert.equal(util.roundDown(1.999999, 2), 1.99);
        assert.equal(util.roundDown(1.999999, 3), 1.999);
        assert.equal(util.roundDown(1.999999, 4), 1.9999);

        assert.equal(util.roundDown(1.23456789, 4), 1.2345);
    });

    it('can round up', () => {
        assert.equal(util.roundUp(1), 1);
        assert.equal(util.roundUp(1, 1), 1);
        assert.equal(util.roundUp(1.2, 1), 1.2);
        assert.equal(util.roundUp(1.29, 1), 1.3);
        assert.equal(util.roundUp(1.999999, 0), 2);
        assert.equal(util.roundUp(1.999999, 1), 2);
        assert.equal(util.roundUp(1.999999, 2), 2);
        assert.equal(util.roundUp(1.999999, 3), 2);
        assert.equal(util.roundUp(1.999999, 4), 2);

        assert.equal(util.roundUp(1.23456789, 4), 1.2346);
    });

    it('can generate a random int', () => {
        for (let i = 0; i < 1000; i++) {
            const val = util.randomRangeInt(300, 400);
            assert.isAtLeast(val, 300);
            assert.isAtMost(val, 400);
            assert.equal(val % 1, 0);
        }
    });

    it('can generate a random number', () => {
        let anyAreFloat = false;
        for (let i = 0; i < 1000; i++) {
            const val = util.randomRange(300, 400);
            assert.isAtLeast(val, 300);
            assert.isAtMost(val, 400);
            if (val % 1 > 0) anyAreFloat = true;
        }

        assert.isTrue(anyAreFloat);
    });
});
