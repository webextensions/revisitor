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

    branches: [
        'dev',
        'main',
        'prod'
    ],

    jobs: [
        {
            // This job will check that the git repository has <= 50 branches
            // This helps to keep the repository clean and manageable and ensuring that there are no branches with pending work
            type: 'gitBranchesCount',
            runOnceForProject: true,
            options: {
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
                approach: '.nvmrc',      // '.nvmrc' / 'auto' (default) / 'package.json'
                ensure: 'stable~2',      // 'latest' / 'stable' / 'stable~1' / 'stable~2' (default)
                                         // Usually (not always), they will map to:
                                         //     'latest':   Latest version (including unstable)
                                         //     'stable':   Latest stable version
                                         //     'stable~1': LTS version
                                         //     'stable~2': Maintenance version
                ensureStrategy: 'patch', // 'major' / 'minor' / 'patch' (default)
                failureStatus: 'warn'    // 'error' / 'warn' (default)
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

* TODO: Pending

# Configuration

## Contents

```
project-monitor/
    package.json
        // dependencies: {
        //     "revisitor": "^0.0.1"
        // },
        // "scripts": {
        //     "revisitor:add":               "revisitor --config ./projects/index.js --add    ",
        //     "revisitor:remove":            "revisitor --config ./projects/index.js --remove ",
        //     "revisitor:execute":           "revisitor --config ./projects/index.js --execute",
        //     "revisitor:cron":              "revisitor --config ./projects/index.js --cron   ",
        //
        //     "revisitor:helpmate:execute":  "revisitor --config ./projects/index.js --execute --project helpmate",
        //
        //     "revisitor:project-2:execute": "revisitor --config ./projects/index.js --execute --project project-2",
        // }
    projects/
        helpmate.revisitor.js (configuration)
        project-2.revisitor.js (configuration)
        project-3.revisitor.js (configuration)
        index.js
            /*
                module.exports = {
                    addAtLocation: 'git-projects',

                    runAndReport: {
                        crons: ['0 0 8 * * *'], // Every day at 8:00:00 AM

                        reportContents: {
                            job:     'onIssue', // 'always' (default) / 'onIssue'
                            project: 'onIssue'  // 'always' (default) / 'onIssue'
                        },
                        reportSend: {
                            project: 'always', // 'always' / 'onIssue' (default) / 'no'
                            runner:  'no'      // 'always' / 'onIssue' / 'no' (default) ; (runner report = combined report)
                        },

                        reportDuration: true,
                        reporters: [
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

                    projects: [
                        require("./helpmate.revisitor.js"),
                        require("./project-2.revisitor.js"),
                        {
                            ...require("./project-3.revisitor.js"),
                            branches: ['master']
                        }
                    ]
                };
            */
```
