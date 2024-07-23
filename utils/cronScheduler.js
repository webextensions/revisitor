const cronParser = require('cron-parser');

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cronScheduler = async function (cronStr, fn, { allowBreaking = false } = {}) {
    // Requirements:
    //     * Whenever the cronStr is satisfied next, the function fn should be called
    //     * The function fn should be called as close to the exact time as per the cronStr
    //     * To set the timed jobs, we will not use setInterval. We will rather use setTimeout
    //         * Usage of setTimeouts with small durations of 1 minute or 1 second is allowed
    //         * That usage of setTimeout is going to ensure that even in case the machine goes to sleep and upon waking
    //           up:
    //               * if the next upcoming cronStr time is not reached yet, then also the function fn will be called at
    //                 the next upcoming cronStr time and the sleep duration does not affect the cronStr time
    //               * if the next upcoming cronStr time has already passed, and even if multiple cyces of cronStr have
    //                 passed, the function fn will be called once at the time of waking up.
    //      * Attempt to keep the millisecond time of execution for each cycle as close to the first instance of execution

    const interval = cronParser.parseExpression(cronStr);
    let next = { instance: interval.next() };
    next.time = next.instance.getTime();

    /*
    // Approach 1: With `setInterval` based approach, a few milliseconds can get added with each cycle
    setInterval(async () => {
        const now = Date.now();
        const gap = next.time - now;

        if (gap < 0) {
            await fn();

            const interval = cronParser.parseExpression(cronStr);
            next = { instance: interval.next() };
            next.time = next.instance.getTime();
        }
    }, 1000);
    /* */

    // Approach 2: With `setTimeout` based approach, the millisecond time of execution for each cycle can be kept close
    //             to the first instance of execution
    const targetMs = Date.now() % 1000; // eg: 200
    while (true) { // eslint-disable-line no-constant-condition
        const syncerNow = Date.now(); // eg: 1600000000215
        const syncerTargetTime = ((syncerNow + 1000) - ((syncerNow + 1000) % 1000)) + targetMs; // eg: 1600000001200
        const syncerGap = syncerTargetTime - syncerNow; // eg: 985
        await timeout(syncerGap);

        const now = Date.now();
        const gap = next.time - now;

        if (gap < 0) {
            const toBreak = await fn();
            if (allowBreaking && toBreak) {
                break;
            }

            const interval = cronParser.parseExpression(cronStr);
            next = { instance: interval.next() };
            next.time = next.instance.getTime();
        }
    }
};

module.exports = { cronScheduler };
