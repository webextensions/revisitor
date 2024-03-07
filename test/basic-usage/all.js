module.exports = {
    reporters: {
        useByRunner: [
            {
                type: 'mail'
            }
        ]
    },
    reportDuration: true,

    projects: [
        require('./helpmate.revisitor.js')
    ]
};
