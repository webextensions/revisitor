module.exports = {
    manifestVersion: 1,
    id: 'note-down',
    title: 'note-down',
    // url: 'git@github.com:webextensions/note-down.git',
    url: '../../../note-down-revisitor-test/.git',

    branches: [
        'master'
    ],

    jobs: [
        {
            type: 'gitBranchesCount',
            runOnceForProject: true,
            options: {
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
                approach: 'ci',       // 'install' / 'ci'
                attempts: 3           // Run the npm ci up to 3 times (if error encountered)
            }
        }
    ]
};
