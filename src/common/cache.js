/**
 * Simple in memory cache
 */
class Cache {
    constructor() {
        this.data = {};
    }

    put(name, value, ttl) {
        if (value === null) {
            this.del(name);
            return;
        }

        this.data[name] = {
            expires: Date.now() + (ttl * 1000),
            value,
        };
    }

    del(name) {
        delete this.data[name];
    }

    get(name) {
        // Find the named value object
        const obj = this.data[name];
        if (!obj) return null;

        // see if it's expired
        const now = Date.now();
        if (now >= obj.expires) {
            this.del(name);
            return null;
        }

        return obj.value;
    }
}

module.exports = Cache;
