const assert = require('chai').assert;
const sinon = require('sinon');

const Cache = require('../src/common/cache');


describe('Cache', () => {
    let clock = null;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it('can put data in the cache', () => {
        const cache = new Cache();
        const val = 'testing testing 123';
        cache.put('test', val, 60);

        assert.isObject(cache.data.test);
        assert.equal(cache.data.test.value, val);
    });

    it('can get data out of the cache', () => {
        const cache = new Cache();
        const val = 'testing testing 123';
        cache.put('test', val, 60);

        assert.equal(cache.get('test'), val);
    });

    it('gets null for items that dont exist', () => {
        const cache = new Cache();

        assert.isNull(cache.get('test'));
    });

    it('can expire items after some time', () => {
        const cache = new Cache();
        const val = 'testing testing 123';
        cache.put('test', val, 60);

        // Should be in the cache
        assert.isNotNull(cache.get('test'));

        // After 59 seconds, it should still be there
        clock.tick(59*1000);
        assert.isNotNull(cache.get('test'));

        // but after 60 seconds, it should be gone
        clock.tick(1*1000);
        assert.isNull(cache.get('test'));
    });
});
