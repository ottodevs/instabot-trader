const assert = require('chai').assert;
const sinon = require('sinon');
const Fregex = require('../src/common/functional-regex');


describe('Functional Regex', () => {
    it('can find all', () => {
        const regex = new Fregex();
        const message = 'Hello World!';
        const callback = sinon.spy();

        regex.forEach(/o/gi, message, callback);

        assert.isTrue(callback.calledTwice);
    });
});
