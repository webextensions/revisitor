import pino from 'pino';

import pinoPretty from 'pino-pretty';

import jsonColorizer from '@pinojs/json-colorizer'; // https://github.com/pinojs/pino-pretty/issues/229#issuecomment-986053242

import stripAnsi from 'strip-ansi';

const LOG_LEVEL = process.env.LOG_LEVEL;

const pinoPrettyStream = pinoPretty({
    colorizeObjects: true,
    // translateTime: 'SYS:standard',
    // translateTime: 'SYS:hh:MM:ss.l TT Z',
    translateTime: 'SYS:HH:MM:ss.l',
    ignore: 'pid,hostname',

    // Note:
    // To make "sync: true" work, the "stream" based approach should be used and not "transport" based one (Ref: https://github.com/pinojs/pino-pretty/issues/504)
    sync: true,

    customPrettifiers: {
        // eslint-disable-next-line no-unused-vars
        level: (logLevel, key, log, { label, labelColorized }) => {
            // https://github.com/pinojs/pino-pretty/issues/489#issuecomment-2009701768
            const padDiff = 5 - stripAnsi(labelColorized).length;
            return labelColorized.padEnd(labelColorized.length + padDiff);
        }
    }
});

// Note: The output color of the message itself can't be set yet, https://github.com/pinojs/pino-pretty/issues/430
const pinoLogger = pino({
    level: ((level) => {
        if (!isNaN(parseFloat(level))) {
            return parseFloat(level);
        } else if ([
            'trace',
            'debug',
            'info',
            'warn',
            'error',
            'fatal',
            'silent'
        ].includes(level)) {
            return level;
        } else {
            return 'info';
        }
    })(LOG_LEVEL)
}, pinoPrettyStream);

const jsonBeautifier = function (json) {
    const jsonStr = JSON.stringify(json, null, 4);
    const colorized = jsonColorizer(jsonStr);
    return colorized;
};

export {
    pinoLogger,
    jsonColorizer as pinoJsonColorizer,
    jsonBeautifier as pinoJsonBeautifier
};
