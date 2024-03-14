module.exports = {
    addAtLocation: 'git-projects',

    runAndReport: {
        crons: ['0 0 8 * * *'], //  Every day at 8:00:00 AM

        reportContents: {
            job:     'onSkipWarn+', // 'always' (default) / 'onSkipWarn+' / 'onWarn+' / 'onError'
            project: 'onSkipWarn+'  // 'always' (default) / 'onSkipWarn+' / 'onWarn+' / 'onError'
        },
        reportSend: {
            project: 'onSkipWarn+', // 'always' / 'onSkipWarn+' / 'onWarn+' (default) / 'onError' / 'no'
            runner:  'no'           // 'always' / 'onSkipWarn+' / 'onWarn+' / 'onError' / 'no' (default) ; (runner report = combined report)
        },

        reportDuration: true,
        reporters: [
            {
                type: 'mail'
            }
        ]
    },

    projects: [
        require('./helpmate.revisitor.js'),
        require('./note-down.revisitor.js')
    ]
};
