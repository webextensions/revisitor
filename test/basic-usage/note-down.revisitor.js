module.exports = {
    manifestVersion: 1,
    id: 'note-down',
    title: 'note-down',
    // url: 'git@github.com:webextensions/note-down.git',
    url: '../../../note-down-revisitor-test/.git',

    branches: {
        recommendedByProject: [
            'master'
        ]
    },
    reporters: {
        recommendedByProject: [
            {
                type: 'slack'
                // ...
                // ...
            }
        ]
    },
    crons: {
        useByRunner: ['30 8 * * *']
    },

    jobs: [
        {
            type: 'gitBranchesCount',
            runOnceForProject: true,
            options: {
                report: 'always',     // 'always' / 'onIssue' (default)
                limit: {
                    warn: 2,          // 2 branches
                    warnIncrement: 2, // Warn on 2+, 4+, 6+
                    error: 7
                }
            }
        },
        {
            type: 'npmInstall',       // Not cleaning npm cache
            runForBranches: [
                'master'
            ],
            options: {
                report: 'always',     // 'always' / 'onIssue' (default)
                approach: 'ci',       // 'install' / 'ci'
                attempts: 3           // Run the npm ci up to 3 times (if error encountered)
            }
        }
    ]
};
