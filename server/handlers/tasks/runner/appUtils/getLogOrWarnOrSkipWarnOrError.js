const getLogOrWarnOrSkipWarnOrError = function ({
    // reportContents_job, // 'always' (default) / 'onIssue' // TODO: Implement
    limit,              // <object>
    deltaDirection,     // 'increment' / 'decrement'
    count,              // <number> for this execution
    lastExecutionCount  // <number> for the last execution
}) {
    if (
        limit &&
        limit.error &&
        (
            (deltaDirection === 'increment' && count >= limit.error) ||
            (deltaDirection === 'decrement' && count <= limit.error)
        )
    ) {
        return 'error';
    } else if (
        limit &&
        typeof limit.warn === 'number' &&
        (
            (deltaDirection === 'increment' && count >= limit.warn) ||
            (deltaDirection === 'decrement' && count <= limit.warn)
        )
    ) {
        let computedSkipWarningWhenFollowingLimit = limit.warn;

        if (
            typeof lastExecutionCount === 'number' &&
            (
                (deltaDirection === 'increment' && lastExecutionCount >= limit.warn) ||
                (deltaDirection === 'decrement' && lastExecutionCount <= limit.warn)
            )
        ) {
            computedSkipWarningWhenFollowingLimit = (
                (
                    lastExecutionCount - (lastExecutionCount % limit.warnIncrement)
                ) +
                limit.warnIncrement
            );
        }

        if (
            (deltaDirection === 'increment' && count >= computedSkipWarningWhenFollowingLimit) ||
            (deltaDirection === 'decrement' && count <= computedSkipWarningWhenFollowingLimit)
        ) {
            return 'warn';
        } else {
            return 'skipWarn';
        }
    } else {
        return 'log';
    }
};

module.exports = { getLogOrWarnOrSkipWarnOrError };
