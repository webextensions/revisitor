const path = require('path');

const dotenv = require('dotenv');

const pathEnvLocal = path.resolve(__dirname, '.env');
const pathEnvProd  = path.resolve(__dirname, '.prod.env');

let pathEnv = pathEnvLocal;
let result;

result = dotenv.config({
    path: pathEnv
});

if (result.error) {
    pathEnv = pathEnvProd;
    result = dotenv.config({
        path: pathEnv // Assuming that this file, represented by `pathEnv` (`pathEnvProd`), always exists and it is readable and it will never lead to a situation where results.error has a truthy value
    });
}
console.log('Loaded environment variables from:', pathEnv);

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const SENDGRID_API_KEY  = process.env.SENDGRID_API_KEY;
const MAIL_FROM         = process.env.MAIL_FROM;
const MAIL_TO_LIST      = (process.env.MAIL_TO_LIST  && process.env.MAIL_TO_LIST.split(','))  || undefined;
const MAIL_CC_LIST      = (process.env.MAIL_CC_LIST  && process.env.MAIL_CC_LIST.split(','))  || undefined;
const MAIL_BCC_LIST     = (process.env.MAIL_BCC_LIST && process.env.MAIL_BCC_LIST.split(',')) || undefined;

module.exports = {
    title: 'health-checks',
    addAtLocation: 'git-projects',

    runAndReport: {
        crons: ['0 0 8 * * *'], //  Every day at 8:00:00 AM

        reportContents: {
            job:     'onWarn+', // 'always' / 'onSkipWarn+' / 'onWarn+' (default) / 'onError'
            branch:  'onWarn+', // 'always' / 'onSkipWarn+' / 'onWarn+' (default) / 'onError'
            project: 'onWarn+'  // 'always' / 'onSkipWarn+' / 'onWarn+' (default) / 'onError'
        },
        reportSend: {
            branch:  'no',      // 'always' / 'onSkipWarn+' / 'onWarn+' / 'onError' (default) / 'no'
            // project: 'no',      // 'always' / 'onSkipWarn+' / 'onWarn+' / 'onError' (default) / 'no'
            project: 'always',
            // runner:  'always'   // 'always' (default) / 'onSkipWarn+' / 'onWarn+' / 'onError' / 'no' ; (runner report = combined report)
            runner:  'no'
        },

        reportDuration: true,
        reporters: [
            {
                type: 'slack',
                url: SLACK_WEBHOOK_URL
            },
            {
                type: 'mail',
                provider: 'sendgrid',
                config: {
                    SENDGRID_API_KEY,
                    MAIL_FROM,
                    MAIL_TO_LIST,
                    MAIL_CC_LIST,
                    MAIL_BCC_LIST
                }
            }
        ]
    },

    projects: [
        require('./helpmate.revisitor.js'),
        require('./note-down.revisitor.js')
    ]
};
