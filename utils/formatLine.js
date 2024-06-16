const { noteDown } = require('note-down');
const chalk = noteDown.chalk;

// format: 'console' / 'markdown' / 'mail'
// reportType: 'error' / 'warn' / 'log'
// message: string / array of strings / array of objects
const formatLine = function (format, reportType, message) {
    let finalMessage = '';

    if (typeof message === 'string') {
        finalMessage = message;
    } else if (Array.isArray(message)) {
        for (const part of message) {
            if (part && typeof part === 'object') {
                const unwrappedPart = part.message || '';
                let wrappedPart = unwrappedPart;

                if (part.color) {
                    if (format === 'console') {
                        if (typeof chalk[part.color] === 'function') {
                            wrappedPart = chalk[part.color](wrappedPart);
                        }
                    } else if (format === 'markdown') {
                        wrappedPart = `*${wrappedPart}*`;
                    } else if (format === 'mail') {
                        wrappedPart = `<span style="color: ${part.color}">${wrappedPart}</span>`;
                    }
                }
                if (part.dim) {
                    if (format === 'console') {
                        wrappedPart = chalk.dim(wrappedPart);
                    } else if (format === 'markdown') {
                        wrappedPart = `_${wrappedPart}_`;
                    } else if (format === 'mail') {
                        wrappedPart = `<em>${wrappedPart}</em>`;
                    }
                }
                if (part.bold) {
                    if (format === 'console') {
                        wrappedPart = chalk.bold(wrappedPart);
                    } else if (format === 'markdown') {
                        wrappedPart = `*${wrappedPart}*`;
                    } else if (format === 'mail') {
                        wrappedPart = `<strong>${wrappedPart}</strong>`;
                    }
                }

                if (part.indentLevel) {
                    if (
                        format === 'console' ||
                        format === 'markdown'
                    ) {
                        wrappedPart = ' '.repeat(4).repeat(part.indentLevel) + wrappedPart;
                    } else if (format === 'mail') {
                        wrappedPart = '&nbsp;'.repeat(4).repeat(part.indentLevel) + wrappedPart;
                    }
                }

                finalMessage += wrappedPart;
            } else {
                finalMessage += part;
            }
        }
    }

    if (reportType === 'error') {
        finalMessage = '✗ ' + finalMessage;
        if (format === 'console') {
            finalMessage = chalk.red(finalMessage);
        } else if (format === 'markdown') {
            // do nothing
        } else if (format === 'mail') {
            finalMessage = `<span style="color: red;">${finalMessage}</span>`;
        }
    } else if (reportType === 'warn') {
        finalMessage = '⚠️ ' + finalMessage;
        if (format === 'console') {
            finalMessage = chalk.yellow(finalMessage);
        } else if (format === 'markdown') {
            // do nothing
        } else if (format === 'mail') {
            finalMessage = `<span style="color: orange;">${finalMessage}</span>`;
        }
    }

    return finalMessage;
};

module.exports = { formatLine };
