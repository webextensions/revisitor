module.exports = {
    manifestVersion: 1,
    id: 'helpmate',
    title: 'Helpmate',
    // url: 'git@github.com:webextensions/helpmate.git',
    url: '../../../helpmate-revisitor-test/.git',

    branches: {
        recommendedByProject: [
            'main'
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
                report: 'always', // 'always' / 'onIssue' (default)
                limit: {
                    warn: 2, // 2 branches
                    warnIncrement: 2, // Warn on 2+, 4+, 6+
                    error: 7
                }
            }
        }
    ]
};
