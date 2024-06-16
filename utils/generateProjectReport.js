const { formatLine } = require('./formatLine.js');
const { notifications } = require('../utils/notifications/notifications.js');

const generateProjectReport = function ({ project, runner }, reportContents, format) {
    const arrReport = [];

    if (runner) {
        notifications.error('Revisitor', 'TODO: Unhandled case for report generation. Exiting!');
        console.error(' ✗ TODO: Unhandled case for report generation. Exiting!');
        process.exit(1);
    }

    for (const branch of project.reports) {
        for (const job of branch.reports) {
            for (const report of job.reports) {
                const [reportType] = report;
                if (
                    ((reportContents.job === 'always')) ||
                    ((reportContents.job === 'onError'     && (reportType === 'error'))) ||
                    ((reportContents.job === 'onWarn+'     && (reportType === 'error' || reportType === 'warn'))) ||
                    ((reportContents.job === 'onSkipWarn+' && (reportType === 'error' || reportType === 'warn' || reportType === 'skipWarn')))
                ) {
                    project.include = true;
                    branch.include = true;
                    job.include = true;

                    if (reportType === 'error') {
                        project.reportType = 'error';
                        branch.reportType  = 'error';
                        job.reportType     = 'error';
                    } else if (reportType === 'warn') {
                        if (project.reportType !== 'error') { project.reportType = 'warn'; }
                        if (branch.reportType  !== 'error') { branch.reportType  = 'warn'; }
                        if (job.reportType     !== 'error') { job.reportType     = 'warn'; }
                    } else if (reportType === 'skipWarn') {
                        if (project.reportType !== 'error' && project.reportType !== 'warn') { project.reportType = 'skipWarn'; }
                        if (branch.reportType  !== 'error' && branch.reportType  !== 'warn') { branch.reportType  = 'skipWarn'; }
                        if (job.reportType     !== 'error' && job.reportType     !== 'warn') { job.reportType     = 'skipWarn'; }
                    } else {
                        if (project.reportType !== 'error' && project.reportType !== 'warn' && project.reportType !== 'skipWarn') { project.reportType = 'log'; }
                        if (branch.reportType  !== 'error' && branch.reportType  !== 'warn' && branch.reportType  !== 'skipWarn') { branch.reportType  = 'log'; }
                        if (job.reportType     !== 'error' && job.reportType     !== 'warn' && job.reportType     !== 'skipWarn') { job.reportType     = 'log'; }
                    }
                }
            }
        }
    }

    if (project.include) {
        arrReport.push(formatLine(format, project.reportType, [{ indentLevel: 0 }, { bold: true, message: `➤ ${project.title}` }]));
    }
    for (const branch of project.reports) {
        if (branch.include) {
            arrReport.push(formatLine(format, branch.reportType, [{ indentLevel: 1 }, { bold: true, message: `➤ ${branch.branch}` }]));
        }
        for (const job of branch.reports) {
            if (job.include) {
                arrReport.push(formatLine(format, job.reportType, [{ indentLevel: 2 }, ` ${job.type}`]));
            }
            for (const report of job.reports) {
                const [reportType, message] = report;
                if (job.include) {
                    arrReport.push(formatLine(format, reportType, message));
                }
            }
        }
    }

    if (format === 'mail') {
        return ([
            '<div style="font-family:monospace">',
            arrReport.join('<br>\n'),
            '</div>'
        ].join('\n'));
    } else {
        return arrReport.join('\n');
    }
};

module.exports = { generateProjectReport };
