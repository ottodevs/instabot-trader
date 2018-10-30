
/**
 * Work out the actual order size for the scaled order for exchanges that use contracts
 */
module.exports = async (context, p) => {
    // need to have at least 1 contract per order
    if (p.amount.units === '') {
        if ((p.amount.value / p.orderCount) < this.minOrderSize) {
            return 0;
        }
    }

    // Order what you like, leverage will adjust
    return p.amount.value;
};
