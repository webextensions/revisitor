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
        path: pathEnv // Assuming that this file, represented by `pathEnv` (`pathEnvProd`), always exists and it is readable and it will never lead to a situation where `result.error` has a truthy value
    });
}
console.log('Loaded environment variables from:', pathEnv);

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

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
            }
        ]
    },

    projects: [
        {
            manifestVersion: 1,
            id: 'helpmate',
            title: 'helpmate',
            url: 'git@github.com:webextensions/helpmate.git',
            // url: '../../../helpmate-revisitor-test/.git',

            branches: [
                'main'
            ],

            jobs: [
                {
                    type: 'nodeOutdated',
                    options: {
                        approach: '.nvmrc',      // '.nvmrc' (default) / 'package.json'
                        ensure: 'stable~2',      // 'latest' / 'stable' / 'stable~1' / 'stable~2' (default)
                        ensureStrategy: 'patch', // 'major' / 'minor' / 'patch' (default)
                        failureStatus: 'warn'    // 'error' / 'warn' (default)
                    }
                },
                {
                    type: 'npmInstall',   // Not cleaning npm cache
                    options: {
                        approach: 'ci',   // 'install' / 'ci'
                        attempts: 3       // Run the npm ci up to 3 times (if error encountered)
                    }
                },
                {
                    type: 'npmOutdated',
                    options: {
                        approach: 'skipExactVersion', // 'all' (default) / 'skipExactVersion'
                        limit: {
                            warn: 1,          // 1 outdated package
                            warnIncrement: 1, // Warn on 1+, 2+, 3+
                            error: 5
                        }
                    }
                }
            ]
        }
    ]
};
