module.exports = {
    manifestVersion: 1,
    id: 'helpmate',
    title: 'helpmate',
    // url: 'git@github.com:webextensions/helpmate.git',
    url: '../../../helpmate-revisitor-test/.git',

    branches: [
        'main',
        'dev'
    ],

    jobs: [
        {
            type: 'gitBranchesCount',
            runOnceForProject: true,
            options: {
                limit: {
                    warn: 2,          // 2 branches
                    warnIncrement: 2, // Warn on 2+, 4+, 6+
                    error: 19
                }
            }
        },
        {
            type: 'npmInstall',   // Not cleaning npm cache
            runForBranches: [
                'main',
                'dev'
            ],
            options: {
                approach: 'ci',   // 'install' / 'ci'
                attempts: 3       // Run the npm ci up to 3 times (if error encountered)
            }
        },
        {
            type: 'npmOutdated',
            runForBranches: [
                'main'
            ],
            options: {
                limit: {
                    warn: 1,          // 1 outdated package
                    warnIncrement: 1, // Warn on 1+, 2+, 3+
                    error: 5
                }
            }
        }
    ]
};
