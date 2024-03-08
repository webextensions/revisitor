module.exports = {
    addAtLocation: 'git-projects',

    reporters: {
        useByRunner: [
            {
                type: 'mail'
            }
        ]
    },
    reportDuration: true,

    projects: [
        require('./helpmate.revisitor.js'),
        require('./note-down.revisitor.js')
    ]
};
