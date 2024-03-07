# Notes

* In a Git project, add `.revisitor.js` to the root of the project like the following example. This file will contain the configuration for the `revisitor` tool.

* Some checks need to run only once per Git project
  eg: gitBranchesLimit, gitRepoSizeChange, gitRepoSizeToContentRatio etc
  comparison basis, eg: openIssuesLimit, openPullRequestsLimit, prMergeConflicts etc
* Some checks need to run on every specified branch/commit
  eg: npmScripts, npmAudit, npmOutdated etc
  comparison basis, eg: lighthouse, gitRepoSizeChange, bundleSize, changesToFiles, changesToDirectories etc

* Some checks may depend on external factors and hence they might be passing one day but fail on another day (eg: npm audit, npm outdated, Node.js outdated, links check, SSL expiry check etc)

```javascript
// Contents of `.revisitor.js`

module.exports = {
    manifestVersion: 1,
    id: 'revisitor',
    title: 'Revisitor',
    url: 'git@github.com:webextensions/revisitor.git',

    crons: {
        recommendedByProject: ['30 8 * * *']
    },
    branches: {
        recommendedByProject: [
            'dev',
            'main',
            'prod'
        ]
    },
    reporters: {
        recommendedByProject: [
            {
                type: 'mail', // 'issue' / 'mail' / 'slack' / 'sms' / 'telegram' / 'upload' / 'webhook' / 'whatsapp'
                ...
                ...
            },
            {
                type: 'webhook',
                ...
                ...
            }
        ]
    },

    jobs: [
        {
            // This job will check that the git repository has <= 50 branches
            // This helps to keep the repository clean and manageable and ensuring that there are no branches with pending work
            type: 'gitBranchesCount',
            runOnceForProject: true,
            options: {
                report: 'always', // 'always' / 'onIssue' (default)
                limit: {
                    warn: 50, // 50 branches
                    warnIncrement: 5, // Warn on 50+, 55+, 60+, ...
                    error: 100
                }
            }
        },
        {
            type: 'gitRepoSize',
            runOnceForProject: true,
            options: {
                limit: {
                    warn:         10 * 1024 * 1024, // 10 MB
                    warnIncrement: 2 * 1024 * 1024  // Warn on 12 MB (if previous was < 12 MB), 14 MB (if previous was < 14 MB), ...
                }
            }
        },
        {
            type: 'gitRepoSizeToContentSizeRatio',
            runOnceForProject: true,
            options: {
                limit: {
                    warn: 0.4, // 0.4 ratio
                    warnDecrement: 0.05 // Warn on <0.4, <0.35, <0.3, ...
                }
            }
        },
        {
            // This job will check that the provided URLs are reachable and return an acceptable status code
            type: 'urls',
            runForBranches: [
                'main',
                'prod'
            ],
            options: {
                lists: [
                    {
                        urls: [
                            'http://www.example.com/redirect-to-https',
                        ],
                        loadUrls: [ // Load the URLs from the provided files and create/merge them into the `urls` list
                            'resources/3rdparty.json'
                        ],
                        urlsSettings: {
                            followRedirects: true, // true (default) / false
                            success: [
                                200
                            ],
                            warn: [
                                429,
                                503
                            ],
                            error: [
                                404
                            ],
                            others: 'warn',
                            attempts: 3 // Attempts per URL in case of error/warn status code
                        }
                    },
                    {
                        urls: [
                            'https://www.example.com/',
                            'https://www.example.com/page1',
                        ],
                        urlsSettings: {
                            followRedirects: false,
                            success: [
                                200,
                                307
                            ],
                            warn: [
                                429,
                                503
                            ],
                            error: [
                                404
                            ],
                            others: 'warn',
                            attempts: 3 // Attempts per URL in case of error/warn status code
                        }
                    }
                ]
            }
        },
        {
            // This job will check that the applied revisitor configuration is up-to-date
            type: 'revisitorConfig',
            runForBranches: [
                'main'
            ],
            options: {
                ...
                ...
            }
        },
        {
            type: 'staleBranches',
            runOnceForProject: true,
            options: {
                lastCommitTimeLimit: {
                    warn: 30,          // Days
                    warnIncrement: 15, // Warn on 30, 45, 60
                    error: 75
                }
            }
        },
        {
            type: 'staleIssues',
            runOnceForProject: true,
            options: {
                ...
                ...
            }
        },
        {
            type: 'stalePullRequests',
            runOnceForProject: true,
            options: {
                ...
                ...
            }
        },
        {
            type: 'openIssuesLimit',
            runOnceForProject: true,
            options: {
                ...
                ...
            }
        },
        {
            type: 'openPullRequestsLimit',
            runOnceForProject: true,
            options: {
                ...
                ...
            }
        },
        {
            type: 'prMergeConflicts',
            runOnceForProject: true,
            options: {
                ...
                ...
            }
        },
        {
            // This job will check that the Node.js version is up to date (via .nvmrc or package.json engines field)
            type: 'nodeOutdated',
            options: {
                report: 'always', // 'always' / 'onIssue' (default)
                status: {
                    major: 'error', // 'error' / 'warn' (default)
                    minor: 'warn',  // 'error' / 'warn' (default)
                    patch: 'warn'   // 'error' / 'warn' (default)
                }
            }
        },
        {
            // This job will check that the package.json and package-lock.json are in sync
            type: 'packageLockOutOfSync',
            options: {
                status: 'error' // 'error' / 'warn' (default)
            }
        },
        {
            type: 'sslCertificateValidity',
            runForBranches: ['prod'],
            options: {
                urls: [
                    'https://www.example.com/',
                    'https://sample.com/',
                ],
                limit: {
                    warn: 30, // 30 days
                    warnDecrement: 5, // Warn on <30, <25, <20, ...
                    error: 7
                }
            }
        },
        {
            type: 'todoNotesCount',
            options: {
                limit: {
                    'TODO:': {
                        warn: 50,
                        warnIncrement: 10
                    },
                    'FIXME:': {
                        warn: 10,
                        warnIncrement: 5
                    },
                    'OPTIMIZE:': {
                        warn: 10,
                        warnIncrement: 5
                    },
                    'HACK:': {
                        warn: 1,
                        warnIncrement: 1
                    }
                }
            }
        },
        {
            type: 'npmInstall', // Not cleaning npm cache
            options: {
                approach: 'ci', // 'install' / 'ci'
                attempts: 3 // Run the npm ci up to 3 times (if error encountered)
            }
        },
        {
            type: 'npmInstallTime', // Not cleaning npm cache
            options: {
                approach: 'install', // 'install' / 'ci'
                limit: {
                    warn: 30, // 30 seconds
                    warnIncrement: 15, // Warn on 30, 45, 60, ...
                    error: 120
                }
                bestOf: 3 // Run the npm install up to 3 times (if error/warning encountered) and take the best time
            }
        },
        {
            // This job will check that the npm dependencies and sub-dependencies have a license that is allowed
            type: 'npmLicense',
            options: {
                allow: ['MIT', 'ISC'],
                disallow: ['GPL', 'AGPL', 'LGPL']
                othersLimit: {
                    warn: 1,
                    warnIncrement: 1,
                    error: 4
                }
            }
        },
        {
            // This job will check that the npm dependencies are up to date
            type: 'npmOutdated',
            options: {
                report: 'always', // 'always' / 'onIssue' (default)
                status: {
                    major: {
                        warn: 1, // 1 package with major update pending
                        warnIncrement: 1,
                        error: 10
                    },
                    minor: {
                        warn: 1, // 1 package with minor update pending
                        warnIncrement: 5,
                        error: 20
                    },
                    patch: {
                        warn: 1, // 1 package with patch update pending
                        warnIncrement: 10,
                        error: 20
                    },
                    ...
                    ...
                }
            }
        },
        {
            // This job will check that npm audit passes
            type: 'npmAudit',
            options: {
                report: 'always', // 'always' / 'onIssue' (default)
                reportDetailsLevel: 'short', // 'short' / 'detailed' (default)
                status: {
                    // "info": {},
                    // "low": {},
                    "moderate": {
                        warn: 1,
                        warnIncrement: 1,
                        error: 10
                    },
                    "high": {
                        warn: 1,
                        warnIncrement: 1,
                        error: 5
                    },
                    "critical": {
                        error: 1
                    },
                    "total": {
                        warn: 20,
                        warnIncrement: 10,
                        error: 50
                    }
                }
            }
        },
        {
            type: 'lighthouse',
            options: {
                execute: {
                    setup: [
                        'npm ci',
                        'npm run build',
                        'npm run clean:for-lighthouse'
                    ],
                    run: [
                        'npm run start:for-lighthouse' // Start the server and once the `url` is accessible, run the lighthouse and upon completion, stop the server
                    ],
                    testUrls: [
                        'http://localhost:3000/',
                        'http://localhost:3000/page1',
                    ],
                    cleanup: [
                        'npm run clean:for-lighthouse'
                    ]
                },
                timeout: 600, // 600 seconds
                ...
                ...
            }
        },
        {
            /*
                Notes:
                    * Changes to files: Content of the file changes / New file / Deleted file (Renamed file) / File permission changes
                    * Changes to directories: New directory / Deleted directory / Directory permission changes / Directory content changes (not recursive)
            */
            type: 'changesToFilesAndDirectories',
            runForBranches: [
                'main',
                'prod'
            ],
            options: {
                info: [
                    'README.md',
                    'SETUP.md',
                    'setup/**/*.*'
                    {
                        type: 'json',
                        path: 'package.json',
                        properties: [
                            'version',
                            'dependencies',
                            'devDependencies'
                        ]
                    }
                ],
                warn: [
                    '3rdparty/**/*'
                ],
                error: [
                    'hacks/'
                ]
            }
        },
        {
            type: 'filesSize',
            options: {
                execute: [
                    'npm ci --prefer-offline',
                    'npm run build'
                ],
                files: [
                    {
                        path: 'dist/bundle.js',
                        type: 'js',
                        limit: {
                            warn: 512 * 1024, // 512 KB
                            warnIncrement: 64 * 1024, // Warn on 512 KB, 576 KB, 640 KB, ...
                            error: 1024 * 1024 // 1 MB
                        }
                    },
                    {
                        path: 'dist/bundle.css',
                        type: 'css',
                        limit: {
                            warn: 128 * 1024, // 128 KB
                            warnIncrement: 16 * 1024, // Warn on 128 KB, 144 KB, 160 KB, ...
                            error: 256 * 1024 // 256 KB
                        }
                    }
                ]
            }
        },
        {
            type: 'tests',
            options: {
                execute: [
                    'npm ci --prefer-offline',
                    'npm run build'
                ],
                tests: [
                    'npm run lint:backend',
                    'npm run lint:frontend',
                    'npm run test'
                ]
            }
        }
    ]
};
```

# Commands

* Add a new project to the list of projects to be revisited:
  `$ npx revisitor --start "./projects/index.js"`

* Show the list of all the projects and their status:
  `$ npx revisitor --ls`

* Restart the projects with the latest version of revisitor:
  `$ npx revisitor --stop-and-ls | npx revisitor@latest --start`

# Configuration

* The properties `crons`, `branches` and `reporters` have options which gets applied as following in the increasing order of importance:
    * `fallbackByRunner`
    * `recommendedByProject`
    * `useByRunner`

    and they are merged as per the following order of increasing importance:
    * runner's configuration (eg: `reporters.fallbackByRunner`)
    * project's configuration (eg: `reporters.recommendedByProject`)
    * runner's configuration (eg: `reporters.useByRunner`)

    The project's `.revisitor.js` file can have the following properties:
    * `crons.recommendedByProject`
    * `branches.recommendedByProject`
    * `reporters.recommendedByProject`

    and it shouldn't specify the `fallbackByRunner` or `useByRunner` properties.

    Use `const sanitizeConfig = require('revisitor/sanitizeConfig.js');` to remove the properties that are not allowed in the project's configuration file (`fallbackByRunner` and `useByRunner`).

# Contents

```
project-monitor/
    package.json
        // dependencies: {
        //     "revisitor": "0.0.1"
        // },
        // "scripts": {
        //     "revisitor:add":               "revisitor --config ./projects/index.js --add    ",
        //     "revisitor:execute":           "revisitor --config ./projects/index.js --execute",
        //     "revisitor:start":             "revisitor --config ./projects/index.js --start  ",
        //     "revisitor:stop":              "revisitor --config ./projects/index.js --stop   ",
        //     "revisitor:remove":            "revisitor --config ./projects/index.js --remove ",
        //
        //     "revisitor:execute:helpmate":  "revisitor --config ./projects/index.js --execute --project helpmate",
        //     "revisitor:execute:project-2": "revisitor --config ./projects/index.js --execute --project project-2",
        // }
    projects/
        helpmate.revisitor.js (configuration)
        project-2.revisitor.js (configuration)
        project-3.revisitor.js (configuration)
        index.js
            /*
                // `sanitizeConfig` would remove the properties that are not allowed in the project's configuration file (`fallbackByRunner` and `useByRunner`)
                const sanitizeConfig = require('revisitor/sanitizeConfig.js');

                module.exports = {
                    reporters: {
                        fallbackByRunner: [
                            {
                                type: 'mail', // 'issue' / 'mail' / 'slack' / 'sms' / 'telegram' / 'upload' / 'webhook' / 'whatsapp'
                                ...
                                ...
                            },
                            {
                                type: 'webhook',
                                ...
                                ...
                            }
                        ]
                    },
                    reportDuration: true,
                    projects: [
                        sanitizeConfig(require("./helpmate.revisitor.js")),
                        sanitizeConfig(require("./project-2.revisitor.js")),
                        {
                            ...sanitizeConfig(require("./project-3.revisitor.js")),
                            branches: {
                                useByRunner: ['master']
                            },
                            crons: {
                                useByRunner: ['0 8 * * *']
                            },
                        }
                    ]
                };
            */
```
