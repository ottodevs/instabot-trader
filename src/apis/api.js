
class ApiInterface {
    /**
     * Get the ticker for a symbol
     * @param symbol
     * @returns {*}
     */
    ticker(symbol) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * Wallet details
     * @returns {*}
     */
    walletBalances() {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * place a limit order
     * @param symbol
     * @param amount
     * @param price
     * @param side
     * @param isEverything
     * @returns {*}
     */
    limitOrder(symbol, amount, price, side, isEverything) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * Place a market order
     * @param symbol
     * @param amount
     * @param side - buy or sell
     * @param isEverything
     */
    marketOrder(symbol, amount, side, isEverything) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * Find active orders
     * @param symbol
     * @param side - buy, sell or all
     * @returns {*}
     */
    activeOrders(symbol, side) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * Cancel some orders
     * @param orders
     * @returns {*}
     */
    cancelOrders(orders) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * Find out about a specific order
     * @param orderId
     * @returns {PromiseLike<{id: *, side: *, amount: number, remaining: number, executed: number, is_filled: boolean}> | Promise<{id: *, side: *, amount: number, remaining: number, executed: number, is_filled: boolean}>}
     */
    order(orderId) {
        return Promise.reject(new Error('Not implemented'));
    }
}

module.exports = ApiInterface;
