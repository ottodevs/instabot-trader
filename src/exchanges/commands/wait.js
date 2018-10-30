const logger = require('../../common/logger').logger;

/**
 * Waits for N seconds
 * wait(duration=12s)
 */
module.exports = (context, args) => {
    const { ex = {} } = context;

    const params = ex.assignParams({ duration: '10s' }, args);
    logger.progress(`WAIT - ${ex.name}`);
    logger.progress(params);

    const delay = ex.timeToSeconds(params.duration, 10);
    logger.progress(`Waiting for ${delay} seconds.`);

    return ex.waitSeconds(delay);
};
