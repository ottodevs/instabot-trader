const assert = require('chai').assert;
const easing = require('../src/common/easing');


describe('Easing', () => {
    it('use linear easing', () => {
        assert.equal(easing(0, 10, 0, 'linear'), 0);
        assert.equal(easing(0, 10, 1, 'linear'), 10);
        assert.equal(easing(0, 10, 0.2, 'linear'), 2);
        assert.equal(easing(0, 10, 0.1, 'linear'), 1);
    });

    it('use ease in', () => {
        assert.equal(easing(0, 10, 0, 'ease-in'), 0);
        assert.equal(easing(0, 10, 1, 'ease-in'), 10);
        assert.equal(easing(0, 10, 0.25, 'ease-in'), 0.625);
        assert.equal(easing(0, 10, 0.5, 'ease-in'), 2.5);
        assert.equal(easing(0, 10, 0.75, 'ease-in'), 5.625);
        assert.equal(easing(0, 10, 0.9, 'ease-in'), 8.1);
    });

    it('use ease out', () => {
        assert.equal(easing(0, 10, 0, 'ease-out'), 0);
        assert.equal(easing(0, 10, 1, 'ease-out'), 10);
        assert.equal(easing(0, 10, 0.25, 'ease-out'), 4.375);
        assert.equal(easing(0, 10, 0.5, 'ease-out'), 7.5);
        assert.equal(easing(0, 10, 0.75, 'ease-out'), 9.375);
        assert.equal(easing(0, 10, 0.9, 'ease-out'), 9.9);
    });

    it('use ease in-out', () => {
        assert.equal(easing(0, 10, 0, 'ease-in-out'), 0);
        assert.equal(easing(0, 10, 1, 'ease-in-out'), 10);
        assert.equal(easing(0, 10, 0.25, 'ease-in-out'), 1.25);
        assert.equal(easing(0, 10, 0.5, 'ease-in-out'), 5);
        assert.equal(easing(0, 10, 0.75, 'ease-in-out'), 8.75);
        assert.equal(easing(0, 10, 0.95, 'ease-in-out'), 9.95);
    });
});
