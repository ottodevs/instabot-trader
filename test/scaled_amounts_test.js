const assert = require('chai').assert;
const util = require('../src/common/util');
const scaledAmounts = require('../src/common/scaled_amounts');


describe('Scaled Amounts', () => {
    it('can handle silly inputs', () => {
        assert.deepEqual(scaledAmounts(0, 10, 0), []);

        const randomised = scaledAmounts(4, 10, 2);
        const min = randomised.reduce((t, entry) => (entry < t ? entry : t), 10);
        assert.isAbove(min, 0);
    });

    it('can generate linear amounts', () => {
        assert.deepEqual(scaledAmounts(5, 10, 0), [2, 2, 2, 2, 2]);
        assert.deepEqual(scaledAmounts(5, 2, 0), [0.4, 0.4, 0.4, 0.4, 0.4]);

        const randomDiff = 0.1;
        const randomised = scaledAmounts(5, 10, randomDiff);
        const sum = util.round(randomised.reduce((t, entry) => t + entry, 0), 4);
        const min = randomised.reduce((t, entry) => (entry < t ? entry : t), 2);
        const max = randomised.reduce((t, entry) => (entry > t ? entry : t), 2);

        assert.equal(sum, 10);
        assert.isBelow(min, 2);
        assert.isAbove(max, 2);
    });
});
