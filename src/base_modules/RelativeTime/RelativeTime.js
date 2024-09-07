import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { convertLocalTimeInIsoLikeFormat } from '../utils/time.js';

const arrMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
];

const
    msInSecond = 1000,
    msInMinute =   60 * msInSecond,
    msInHour   =   60 * msInMinute,
    msInDay    =   24 * msInHour,
    msInWeek   =    7 * msInDay,
    msIn5Weeks =    5 * msInWeek;

const getReadableRelativeTime = {
    before: function (timestamp) {
        const now = new Date();
        const dateForTimestamp = new Date(timestamp);

        // @ts-ignore
        let diffInMs = now - timestamp;
        if (diffInMs >= 0) {
            // do nothing
        } else {
            diffInMs = -1;
        }

        const
            timeDiffInSeconds = diffInMs          / 1000,
            timeDiffInMinutes = timeDiffInSeconds /   60,
            timeDiffInHours   = timeDiffInMinutes /   60,
            timeDiffInDays    = timeDiffInHours   /   24,
            timeDiffInWeeks   = timeDiffInDays    /    7;

        let relativeTime;
        let nextUpdateIn;
        if (timeDiffInDays >= 364) {
            relativeTime = dateForTimestamp.getDate() + ' ' + arrMonths[dateForTimestamp.getMonth()] + ' ' + dateForTimestamp.getFullYear();
            nextUpdateIn = null;
        } else if (timeDiffInWeeks >= 5) {
            relativeTime = dateForTimestamp.getDate() + ' ' + arrMonths[dateForTimestamp.getMonth()];
            nextUpdateIn = msIn5Weeks - (diffInMs % msIn5Weeks);
        } else if (timeDiffInWeeks   >= 1) { relativeTime = Math.floor(timeDiffInWeeks  ) + 'w'; nextUpdateIn = msInWeek   - (diffInMs % msInWeek  );
        } else if (timeDiffInDays    >= 1) { relativeTime = Math.floor(timeDiffInDays   ) + 'd'; nextUpdateIn = msInDay    - (diffInMs % msInDay   );
        } else if (timeDiffInHours   >= 1) { relativeTime = Math.floor(timeDiffInHours  ) + 'h'; nextUpdateIn = msInHour   - (diffInMs % msInHour  );
        } else if (timeDiffInMinutes >= 1) { relativeTime = Math.floor(timeDiffInMinutes) + 'm'; nextUpdateIn = msInMinute - (diffInMs % msInMinute);
        } else if (timeDiffInSeconds >= 1) { relativeTime = Math.floor(timeDiffInSeconds) + 's'; nextUpdateIn = msInSecond - (diffInMs % msInSecond);
        } else if (timeDiffInSeconds >= 0) { relativeTime = 'Just now';                          nextUpdateIn = msInSecond - (diffInMs % msInSecond);
        } else {
            relativeTime = dateForTimestamp.getDate() + ' ' + arrMonths[dateForTimestamp.getMonth()] + ' ' + dateForTimestamp.getFullYear();
            nextUpdateIn = null;
        }

        return {
            relativeTime,
            nextUpdateIn
        };
    }
};

const RelativeTime = function (props) {
    const {
        type,
        time,
        live = true
    } = props;

    const [now, setNow] = useState(Date.now());

    const delta = now - time;

    // TODO: Simplify the following duplicacy of logic

    useEffect(() => {
        if (live) {
            if (type === 'past') {
                if (delta < 0) { // Ideally, this should not occur, but it can happen because of out-of-sync clock
                    // do nothing
                } else {
                    const { nextUpdateIn } = getReadableRelativeTime.before(time);

                    if (typeof nextUpdateIn === 'number') {
                        const timer = setTimeout(
                            () => {
                                setNow(Date.now());
                            },
                            Math.max(1, Math.min(nextUpdateIn, 2147483647))
                        );

                        return () => {
                            clearTimeout(timer);
                        };
                    }
                }
            }
        }
    }, [delta, time, type, live]);

    if (type === 'past') {
        if (delta < 0) { // Ideally, this should not occur, but it can happen because of out-of-sync clock
            // do nothing
        } else {
            const { relativeTime } = getReadableRelativeTime.before(time);

            return (
                <React.Fragment>
                    {relativeTime}
                </React.Fragment>
            );
        }
    }

    const currentTimestamp = convertLocalTimeInIsoLikeFormat(time);
    return (
        <React.Fragment>
            {currentTimestamp}
        </React.Fragment>
    );
};

RelativeTime.propTypes = {
    type: PropTypes.string.isRequired,
    time: PropTypes.number.isRequired,
    live: PropTypes.bool
};

export { RelativeTime };
