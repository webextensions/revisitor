const path = require('path');

const dotenv = require('dotenv');

const pathEnvLocal = path.resolve(__dirname, '.env');
const pathEnvProd  = path.resolve(__dirname, '.prod.env');

let result = dotenv.config({
    path: pathEnvLocal
});

if (!result.error) {
    console.log('Loaded environment variables from:', pathEnvLocal);
} else {
    result = dotenv.config({
        path: pathEnvProd
    });
    console.log('Loaded environment variables from:', pathEnvProd);
}

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const SENDGRID_API_KEY  = process.env.SENDGRID_API_KEY;
const MAIL_FROM         = process.env.MAIL_FROM;
const MAIL_TO_LIST      = (process.env.MAIL_TO_LIST  && process.env.MAIL_TO_LIST.split(','))  || undefined;
const MAIL_CC_LIST      = (process.env.MAIL_CC_LIST  && process.env.MAIL_CC_LIST.split(','))  || undefined;
const MAIL_BCC_LIST     = (process.env.MAIL_BCC_LIST && process.env.MAIL_BCC_LIST.split(',')) || undefined;

module.exports = {
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
            project: 'always',      // 'always' / 'onSkipWarn+' / 'onWarn+' / 'onError' (default) / 'no'
            // runner:  'always'   // 'always' (default) / 'onSkipWarn+' / 'onWarn+' / 'onError' / 'no' ; (runner report = combined report)
            runner:  'no'   // 'always' (default) / 'onSkipWarn+' / 'onWarn+' / 'onError' / 'no' ; (runner report = combined report)
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
