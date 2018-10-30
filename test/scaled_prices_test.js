const assert = require('chai').assert;
const scaledPrices = require('../src/common/scaled_prices');


describe('Scaled Prices', () => {
    it('can generate a range of prices', () => {
        assert.deepEqual(scaledPrices(5, 1000, 1100), [1000, 1025, 1050, 1075, 1100]);

        assert.deepEqual(scaledPrices(5, 1000, 1100, 0, 'linear'), [1000, 1025, 1050, 1075, 1100]);
        assert.deepEqual(scaledPrices(5, 1000, 1100, 0, 'ease-in'), [1000, 1006.25, 1025, 1056.25, 1100]);
        assert.deepEqual(scaledPrices(5, 1000, 1100, 0, 'ease-out'), [1000, 1043.75, 1075, 1093.75, 1100]);

        const randomised = scaledPrices(5, 1000, 1100, 0.05);
        const min = randomised.reduce((t, entry) => (entry < t ? entry : t), 2000);
        const max = randomised.reduce((t, entry) => (entry > t ? entry : t), 0);
        assert.isAtLeast(min, 1000);
        assert.isAtMost(min, 1100);
        assert.isAtLeast(max, 1000);
        assert.isAtMost(max, 1100);
        assert.isAtLeast(randomised[1] - randomised[0], 25 - (100 * 0.05));
    });
});
