#!/usr/bin/env node

/* eslint-disable filenames/no-index */

const path = require('node:path');
const fs = require('node:fs');

const {
    logger,
    noteDown
} = require('note-down');
const chalk = noteDown.chalk;
noteDown.option('showLogLine', false);

const schedule = require('node-schedule');

const { htmlEscape } = require('helpmate/dist/misc/htmlEscape.cjs');
const { tryCatchSafe } = require('helpmate/dist/control/tryCatch.cjs');

const semver = require('semver');

const {
    pinoLogger,
    pinoJsonBeautifier
} = require('./utils/pinoLogger.js');

const { formatLine } = require('./appUtils/formatLine.js');
const { generateProjectReport } = require('./appUtils/generateProjectReport.js');
const { getLogOrWarnOrSkipWarnOrError } = require('./appUtils/getLogOrWarnOrSkipWarnOrError.js');
const { tagNodeVersions } = require('./appUtils/nodeOutdated/nodeOutdatedHelpers.js');

const { sendSlackMessage } = require('./reporters/slack/sendSlackMessage.js');
const { sendMail } = require('./reporters/mail/sendMail.js');

const { program } = require('commander');

program
    .option('--config  <config>')
    .option('--add')
    .option('--remove')
    .option('--execute')
    .option('--cron')
    .option('--project <project>');

program.parse();

const opts = program.opts();

// Note: Don't use `execaConfig` where we need to store the output of the command into some variable and perform some
//       further operations
const execaConfig = (function () {
    const LOG_LEVEL = process.env.LOG_LEVEL;

    const config = {};

    if (
        LOG_LEVEL === 'trace' ||
        LOG_LEVEL === 'debug'
    ) {
        config.stdout = 'inherit';
        config.stderr = 'inherit';
        config.verbose = 'full';
    }

    return config;
})();

const cwd = process.cwd();
pinoLogger.debug(`Current working directory: ${cwd}`);

const configPath = path.resolve(cwd, opts.config);
pinoLogger.info(`Loading configuration from: ${configPath}`);
const config = require(configPath);

class ReportIfError {
    constructor({ reporters }) {
        this.reporters = reporters;
    }

    async run(fn) {
        try {
            await fn();
            return [null];
        } catch (err) {
            pinoLogger.error(err);

            for (const reporter of this.reporters) {
                switch (reporter.type) {
                    case 'slack': {
                        const webhookUrl = reporter.url;

                        const [errSlack, warningSlack, responseSlack] = await sendSlackMessage({
                            webhookUrl,
                            message: [
                                '*Revisitor - Error*',
                                '',
                                '`' + err + '`',
                                '',
                                '```',
                                err.stack,
                                '```'
                            ].join('\n')
                        });

                        if (errSlack) {
                            pinoLogger.error(chalk.red('✗ Error in posting message to Slack:'));
                            pinoLogger.error(chalk.red(`      Status: ${errSlack.response?.status}`));
                            pinoLogger.error(chalk.red(`      Body: ${errSlack.response?.body}`));
                        } else if (warningSlack) {
                            pinoLogger.warn(chalk.yellow(`⚠️ Warning in posting message to Slack: ${warningSlack}`));
                        } else {
                            pinoLogger.info(`${chalk.green('✔')} Message posted to Slack successfully: ${responseSlack.body}`);
                        }

                        break;
                    }
                    case 'mail': {
                        const provider = reporter.provider;

                        if (provider === 'sendgrid') {
                            const [errMail, warningMail, statusMail] = await sendMail(
                                {
                                    apiKey: reporter.config.SENDGRID_API_KEY
                                },
                                {
                                    from: reporter.config.MAIL_FROM,
                                    to: reporter.config.MAIL_TO_LIST,
                                    cc: reporter.config.MAIL_CC_LIST,
                                    bcc: reporter.config.MAIL_BCC_LIST,
                                    subject: 'Revisitor - Error',
                                    body: [
                                        'Revisitor - Error',
                                        '',
                                        '<pre>' + htmlEscape(String(err)) + '</pre>',
                                        '',
                                        '<pre>' + htmlEscape(String(err.stack)) + '</pre>'
                                    ].join('\n')
                                }
                            );
                            if (errMail) {
                                pinoLogger.error(chalk.red(`✗ Error in mailing message: ${errMail}`));
                            } else if (warningMail) {
                                pinoLogger.warn(chalk.yellow(`⚠️ Warning in mailing message: ${warningMail}`));
                            } else {
                                pinoLogger.info(`${chalk.green('✔')} Message mailed successfully: ${statusMail}`);
                            }
                        } else {
                            pinoLogger.error(chalk.red('✗ Unknown mail provider'));
                        }

                        break;
                    }
                    default: {
                        pinoLogger.error(chalk.red(`✗ Unknown reporter type`));
                    }
                }
            }

            return [err];
        }
    }
}

const logAndStore = function (arr, reportType, message) {
    const format = 'console';
    const formattedMessage = formatLine(format, reportType, message);

    console.log(formattedMessage);

    arr.push([reportType, message]);
};

const submitReports = async function ({
    reportContents_project,
    reportContents_branch,
    reportContents_job,

    // reportSend_runner,  // TODO: Implement
    // reportSend_project, // TODO: Implement
    // reportSend_branch,  // TODO: Implement

    reporters,

    // runAndReport,       // TODO: Implement

    forRunner,
    forProject,
    forBranch
}) {
    if (!forRunner) {
        console.error(chalk.red(` ✗ Unknown report type. Exiting...`));
        process.exit(1);
    }

    const reportContents = {
        project: reportContents_project,
        branch:  reportContents_branch,
        job:     reportContents_job
    };

    for (const reporter of reporters) {
        let formatToUse = null;

        switch (reporter.type) {
            case 'slack': {
                formatToUse = 'markdown';
                break;
            }
            case 'mail': {
                formatToUse = 'mail';
                break;
            }
            default: {
                console.error(chalk.red(` ✗ Unknown reporter type`));
            }
        }

        const generatedReport = generateProjectReport(
            {
                forRunner,
                forProject,
                forBranch
            },
            reportContents,
            formatToUse
        );

        pinoLogger.debug('Generated report:');
        pinoLogger.debug(generatedReport);

        if (!generatedReport) {
            return;
        }

        const messageTitle = [
            'Revisitor',
            ([
                forRunner?.title,
                forProject?.title,
                forBranch?.branch
            ].filter((x) => x).join('/'))
        ].filter((x) => x).join(' - ');

        switch (reporter.type) {
            case 'slack': {
                const webhookUrl = reporter.url;

                let message = generatedReport;
                // By default, `✔` gets converted to `:heavy_check_mark:` which doesn't look great, hence, converting it to `✓`
                message = message.replaceAll('✔', '✓');

                message = message.replaceAll('⚠️', ' ! '); // Using ' ! ' (exclamation with a space) since '!' alone doesn't seem to occupy enough space (in Slack)

                message = messageTitle + '\n\n' + message;

                const [err, warning, response] = await sendSlackMessage({
                    webhookUrl,
                    message
                });

                if (err) {
                    pinoLogger.error(chalk.red('✗ Error in posting message to Slack:'));
                    pinoLogger.error(chalk.red(`      Status: ${err.response?.status}`));
                    pinoLogger.error(chalk.red(`      Body: ${err.response?.body}`));
                } else if (warning) {
                    pinoLogger.warn(chalk.yellow(`⚠️ Warning in posting message to Slack: ${warning}`));
                } else {
                    logger.log('');
                    pinoLogger.info(`${chalk.green('✔')} Message posted to Slack successfully: ${response.body}`);
                }

                break;
            }
            case 'mail': {
                const provider = reporter.provider;

                if (provider === 'sendgrid') {
                    const [err, warning, status] = await sendMail(
                        {
                            apiKey: reporter.config.SENDGRID_API_KEY
                        },
                        {
                            from: reporter.config.MAIL_FROM,
                            to: reporter.config.MAIL_TO_LIST,
                            cc: reporter.config.MAIL_CC_LIST,
                            bcc: reporter.config.MAIL_BCC_LIST,
                            subject: messageTitle,
                            body: generatedReport
                        }
                    );
                    if (err) {
                        pinoLogger.error(chalk.red(`✗ Error in mailing message: ${err}`));
                    } else if (warning) {
                        pinoLogger.warn(chalk.yellow(`⚠️ Warning in mailing message: ${warning}`));
                    } else {
                        pinoLogger.info(`${chalk.green('✔')} Message mailed successfully: ${status}`);
                    }
                } else {
                    pinoLogger.error(chalk.red('✗ Unknown mail provider'));
                }

                break;
            }
            default: {
                pinoLogger.error(chalk.red(`✗ Unknown reporter type`));
            }
        }
    }
};

const mainExecution = async function ({
    $,

    config,

    source,

    addAtLocation,

    reportContents_project,
    reportContents_branch,
    reportContents_job,

    reportSend_runner,
    reportSend_project,
    reportSend_branch,

    reportDuration,
    reporters,

    runAndReport,
    projects
}) {
    const forRunner = {
        title: config.title || 'Task Runner',
        time: Date.now(),
        reports: []
    };

    const reportIfError = new ReportIfError({ reporters });

    for (const project of projects) {
        await reportIfError.run(async () => {
            const {
                id,
                title
            } = project;

            logger.log(`\n➤ Project: ${title}`);
            // logAndStore(forProject.reports, 'log', `\n➤ Project: ${title}`);

            const forProject = {
                time: Date.now(),
                id,
                title,
                reports: []
            };

            const forProject_status = {
                time: Date.now(),
                branches: {}
            };

            process.chdir(`/var/tmp/revisitor/${addAtLocation}`);

            // eslint-disable-next-line no-unused-vars
            const [errFileRead, oldExecutionStatsFileContents] = tryCatchSafe(() => {
                const output = fs.readFileSync(`${id}.json`, 'utf8');
                return output;
            }, '[]');

            // eslint-disable-next-line no-unused-vars
            const [errJsonParse, oldStatusJson] = tryCatchSafe(() => {
                const output = JSON.parse(oldExecutionStatsFileContents);
                return output;
            }, []);
            const forProject_status_lastExecution = oldStatusJson[oldStatusJson.length - 1];

            process.chdir(id);
            const cwd = process.cwd();
            pinoLogger.debug(`Current working directory: ${cwd}`);

            await $(execaConfig)`git fetch`;

            for (const branch of project.branches) {
                await reportIfError.run(async () => {
                    logger.log(`    ➤ Branch: ${branch}`);
                    // logAndStore(forBranch.reports, 'log', `    ➤ Branch: ${branch}`);

                    const forBranch = {
                        time: Date.now(),
                        branch,
                        reports: []
                    };

                    const forBranch_status_lastExecution = forProject_status_lastExecution?.branches[branch];

                    const forBranch_status = {};
                    forProject_status.branches[branch] = {
                        jobs: forBranch_status
                    };

                    if (branch !== '{project-level-jobs}') {
                        await $(execaConfig)`git checkout ${branch}`;
                        await $(execaConfig)`git reset --hard origin/${branch}`;
                    }

                    for (const job of project.jobs) {
                        await reportIfError.run(async () => {
                            const {
                                type,
                                runOnceForProject,
                                runForBranches
                            } = job;
                            const computedJobId = job.type + (job.id ? ('-' + job.id) : '');

                            if (runOnceForProject) {
                                if (branch !== '{project-level-jobs}') {
                                    return;
                                }
                            } else {
                                if (branch === '{project-level-jobs}') {
                                    return;
                                }
                            }

                            if (
                                runForBranches &&
                                !runForBranches.includes(branch)
                            ) {
                                return;
                            }

                            logger.log(`        ➤ Job: ${type}`);
                            // logAndStore(forBranch.reports, 'log', `        ➤ Job: ${type}`);

                            const forJob = {
                                time: Date.now(),
                                type,
                                id: computedJobId,
                                reports: []
                            };

                            const forJob_statusData = {};
                            const forJob_status = {
                                status: forJob_statusData
                            };

                            forBranch_status[computedJobId] = forJob_status;

                            const forJobData_status_lastExecution = forBranch_status_lastExecution?.jobs[computedJobId]?.status;

                            if (type === 'gitBranchesCount') {
                                const { options } = job;

                                const t1 = Date.now();
                                await $(execaConfig)`git remote prune origin`;
                                const branches = await $`git branch -r`.pipe`grep -v ${'origin/HEAD'}`.pipe`wc -l`;
                                const t2 = Date.now();
                                let durationToAppend = '';
                                if (reportDuration) {
                                    durationToAppend = [' ', { dim: true, message: `(${t2 - t1}ms)` }];
                                }
                                const branchesCount = parseInt(branches.stdout.trim());
                                forJob_statusData.branchesCount = branchesCount;

                                const lastExecutionBranchesCount = forJobData_status_lastExecution?.branchesCount;

                                const whatToDo = getLogOrWarnOrSkipWarnOrError({
                                    reportContents_job,
                                    limit: options.limit,
                                    deltaDirection: 'increment',
                                    count: branchesCount,
                                    lastExecutionCount: lastExecutionBranchesCount
                                });

                                if (whatToDo === 'error') {
                                    logAndStore(forJob.reports, 'error',    [{ indentLevel: 3 }, { color: 'red',    message:       `✗ Branches count: ${branchesCount} >= ${options.limit.error} (error limit)` },                    ...durationToAppend]);
                                } else if (whatToDo === 'warn') {
                                    logAndStore(forJob.reports, 'warn',     [{ indentLevel: 3 }, { color: 'yellow', message:       `⚠️ Branches count: ${branchesCount} >= ${options.limit.warn} (warning limit)` },                   ...durationToAppend]);
                                } else if (whatToDo === 'skipWarn') {
                                    logAndStore(forJob.reports, 'skipWarn', [{ indentLevel: 3 },                                   `✔ Branches count: ${branchesCount} >= ${options.limit.warn} (warning limit - skipped threshold)`, ...durationToAppend]);
                                } else {
                                    logAndStore(forJob.reports, 'log',      [{ indentLevel: 3 }, { color: 'green',  message: '✔' }, ` Branches count: ${branchesCount}`,                                                              ...durationToAppend]);
                                }
                            } else if (type === 'nodeOutdated') {
                                const t1 = Date.now();

                                const { options } = job;

                                let versionToEnsure;
                                if (options.approach === '.nvmrc') {
                                    // Read the .nvmrc file
                                    const nvmrcContents = fs.readFileSync('.nvmrc', 'utf8');
                                    versionToEnsure = nvmrcContents.trim();
                                    if (versionToEnsure.indexOf('v') !== 0) {
                                        versionToEnsure = 'v' + versionToEnsure;
                                    }
                                }

                                const taggedVersions = await tagNodeVersions();

                                let range;

                                if (options.ensure === 'latest') {
                                    range = taggedVersions.latest;
                                } else if (options.ensure === 'stable') {
                                    range = taggedVersions.stable;
                                } else if (options.ensure === 'stable~1') {
                                    range = taggedVersions.stableTilde1;
                                } else { // options.ensure === 'stable~2'
                                    range = taggedVersions.stableTilde2;
                                }

                                if (options.ensureStrategy === 'major') {
                                    range = '>=' + semver.major(range) + '.x.x';
                                } else if (options.ensureStrategy === 'minor') {
                                    range = '>=' + semver.major(range) + '.' + semver.minor(range) + '.x';
                                } else { // options.ensureStrategy === 'patch'
                                    range = '>=' + semver.major(range) + '.' + semver.minor(range) + '.' + semver.patch(range);
                                }

                                const flagSatisfied = semver.satisfies(versionToEnsure, range);

                                const t2 = Date.now();
                                let durationToAppend = '';
                                if (reportDuration) {
                                    durationToAppend = [' ', { dim: true, message: `(${t2 - t1}ms)` }];
                                }

                                forJob_statusData.outdated = flagSatisfied ? null : versionToEnsure;

                                let whatToDo;

                                if (flagSatisfied) {
                                    whatToDo = 'log';
                                } else {
                                    if (options.failureStatus === 'warn') {
                                        whatToDo = 'warn';
                                    } else {
                                        whatToDo = 'error';
                                    }
                                }

                                if (whatToDo === 'log') {
                                    logAndStore(forJob.reports, 'log',   [{ indentLevel: 3 }, { color: 'green',  message: '✔' }, ` Node version: ${versionToEnsure} is satisfied by ${range}`, ...durationToAppend]);
                                } else if (whatToDo === 'warn') {
                                    logAndStore(forJob.reports, 'warn',  [{ indentLevel: 3 }, { color: 'yellow', message: `⚠️ Node version: ${versionToEnsure} is not satisfied by ${range}` }, ...durationToAppend]);
                                } else { // whatToDo === 'error'
                                    logAndStore(forJob.reports, 'error', [{ indentLevel: 3 }, { color: 'red',    message: `✗ Node version: ${versionToEnsure} is not satisfied by ${range}` }, ...durationToAppend]);
                                }
                            } else if (type === 'npmOutdated') {
                                const { options } = job;
                                const { approach } = options;

                                const t1 = Date.now();
                                const outdated = await $`npx --yes npm-check-updates --jsonUpgraded`;
                                const t2 = Date.now();
                                let durationToAppend = '';
                                if (reportDuration) {
                                    durationToAppend = [' ', { dim: true, message: `(${t2 - t1}ms)` }];
                                }
                                const outdatedJsonObj = JSON.parse(outdated.stdout.trim());
                                let outdatedJson = Object.entries(outdatedJsonObj);

                                switch (approach) {
                                    case 'skipExactVersion': {
                                        // eslint-disable-next-line no-unused-vars
                                        outdatedJson = outdatedJson.filter(([packageName, packageVersion]) => {
                                            if (packageVersion.charAt(0) === '^' || packageVersion.charAt(0) === '~') {
                                                return true;
                                            } else {
                                                return false;
                                            }
                                        });
                                        break;
                                    }
                                    case 'all':
                                    default: {
                                        // do nothing
                                    }
                                }

                                forJob_statusData.outdated = outdatedJson;

                                const lastExecutionOutdated = forJobData_status_lastExecution?.outdated;

                                const whatToDo = getLogOrWarnOrSkipWarnOrError({
                                    reportContents_job,
                                    limit: options.limit,
                                    deltaDirection: 'increment',
                                    count: outdatedJson.length,
                                    lastExecutionCount: lastExecutionOutdated?.length
                                });

                                if (whatToDo === 'error') {
                                    logAndStore(forJob.reports, 'error',    [{ indentLevel: 3 }, { color: 'red',    message:       `✗ Outdated npm packages count: ${outdatedJson.length} >= ${options.limit.error} (error limit)` },                    ...durationToAppend]);
                                } else if (whatToDo === 'warn') {
                                    logAndStore(forJob.reports, 'warn',     [{ indentLevel: 3 }, { color: 'yellow', message:       `⚠️ Outdated npm packages count: ${outdatedJson.length} >= ${options.limit.warn} (warning limit)` },                   ...durationToAppend]);
                                } else if (whatToDo === 'skipWarn') {
                                    logAndStore(forJob.reports, 'skipWarn', [{ indentLevel: 3 },                                   `✔ Outdated npm packages count: ${outdatedJson.length} >= ${options.limit.warn} (warning limit - skipped threshold)`, ...durationToAppend]);
                                } else {
                                    logAndStore(forJob.reports, 'log',      [{ indentLevel: 3 }, { color: 'green',  message: '✔' }, ` Outdated npm packages count: ${outdatedJson.length}`,                                                              ...durationToAppend]);
                                }
                            } else if (type === 'npmInstall') {
                                const { options } = job;
                                const {
                                    approach,
                                    attempts
                                } = options;

                                let errorOccurred = false;
                                let attemptInstance = 0;
                                let attemptDuration = 0;
                                let totalDuration = 0;
                                try {
                                    for (let i = 0; i < attempts; i++) {
                                        try {
                                            attemptInstance = i + 1;
                                            const t1 = Date.now();
                                            await $(execaConfig)`npm ${approach}`;
                                            const t2 = Date.now();
                                            attemptDuration = t2 - t1;
                                            totalDuration += attemptDuration;
                                            break;
                                        } catch (error) {
                                            if (i === attempts - 1) {
                                                throw error;
                                            }
                                        }
                                    }
                                    forJob_statusData.worked = 'yes';
                                } catch (err) {
                                    errorOccurred = true;
                                    forJob_statusData.worked = 'no';
                                }

                                if (errorOccurred) {
                                    logAndStore(forJob.reports, 'error', [{ indentLevel: 3 }, { color: 'red', message: `✗ npm ${approach} failed in ${attemptInstance} attempt(s)` }]);
                                } else  {
                                    let durationToAppend = '';
                                    if (reportDuration) {
                                        if (attemptInstance > 1) {
                                            durationToAppend = [' ', { dim: true, message: `(${attemptDuration}ms / ${totalDuration}ms)` }];
                                        } else {
                                            durationToAppend = [' ', { dim: true, message: `(${attemptDuration}ms)` }];
                                        }
                                    }
                                    logAndStore(forJob.reports, 'log', [{ indentLevel: 3 }, { color: 'green', message: '✔' }, ` npm ${approach}`, ...durationToAppend]);
                                }
                            }

                            forJob.duration = Date.now() - forJob.time;
                            forJob_status.duration = forJob.duration;

                            forBranch.reports.push(forJob);
                        });
                    }

                    forBranch.duration = Date.now() - forBranch.time;

                    forProject.reports.push(forBranch);

                    if (reportSend_branch !== 'no') {
                        await submitReports({
                            reportContents_project,
                            reportContents_branch,
                            reportContents_job,

                            reportSend_runner,
                            reportSend_project,
                            reportSend_branch,

                            reporters,

                            runAndReport,

                            // generateFor: 'branch',
                            forRunner,
                            forProject,
                            forBranch
                        });
                    }
                });
            }

            forProject.duration = Date.now() - forProject.time;

            forRunner.reports.push(forProject);

            if (source === 'cron') {
                process.chdir(`/var/tmp/revisitor/${addAtLocation}`);
                await $(execaConfig)`touch ${id}.json`;

                const newStatusJson = structuredClone(oldStatusJson);
                newStatusJson.push(forProject_status);
                fs.writeFileSync(`${id}.json`, JSON.stringify(newStatusJson, null, '\t') + '\n');
            }

            if (reportSend_project !== 'no') {
                await submitReports({
                    reportContents_project,
                    reportContents_branch,
                    reportContents_job,

                    reportSend_runner,
                    reportSend_project,
                    reportSend_branch,

                    reporters,

                    runAndReport,

                    // generateFor: 'project',
                    forRunner,
                    forProject
                });
            }
        });
    }

    if (reportSend_runner !== 'no') {
        await submitReports({
            reportContents_project,
            reportContents_branch,
            reportContents_job,

            reportSend_runner,
            reportSend_project,
            reportSend_branch,

            reporters,

            runAndReport,

            // generateFor: 'runner',
            forRunner
        });
    }
};

const validateWithFallback = function (value, allowedValues, fallbackValue) {
    if (allowedValues.includes(value)) {
        return value;
    }
    return fallbackValue;
};

const validateReportContentsOption = function (reportContents, fallbackValue) {
    const allowedValues = ['always', 'onSkipWarn+', 'onWarn+', 'onError'];
    const value = validateWithFallback(reportContents, allowedValues, fallbackValue);
    return value;
};

const validateReportSendOption = function (reportSend, fallbackValue) {
    const allowedValues = ['always', 'onSkipWarn+', 'onWarn+', 'onError', 'no'];
    const value = validateWithFallback(reportSend, allowedValues, fallbackValue);
    return value;
};

(async () => {
    const { $ } = await import('execa');

    const addAtLocation = config.addAtLocation || 'git-projects-cache';

    const runAndReport           = config.runAndReport         || {};

    const crons                  = runAndReport.crons          || [];

    const reportContents_project = validateReportContentsOption(runAndReport.reportContents?.project, 'onWarn+');
    const reportContents_branch  = validateReportContentsOption(runAndReport.reportContents?.branch,  'onWarn+');
    const reportContents_job     = validateReportContentsOption(runAndReport.reportContents?.job,     'onWarn+');

    const reportSend_runner      = validateReportSendOption(runAndReport.reportSend?.runner,  'always' );
    const reportSend_project     = validateReportSendOption(runAndReport.reportSend?.project, 'onError');
    const reportSend_branch      = validateReportSendOption(runAndReport.reportSend?.branch,  'onError');

    const reportDuration         = runAndReport.reportDuration || false;
    const reporters              = runAndReport.reporters      || [];

    if (
        opts.add     ||
        opts.remove  ||
        opts.execute ||
        opts.cron
    ) {
        const projectsToOperateOn = (
            (typeof opts.project === 'string') ?
                config.projects.filter((project) => project.id === opts.project) :
                config.projects
        );

        if (projectsToOperateOn.length === 0) {
            console.log('');
            if (typeof opts.project === 'string') {
                pinoLogger.error(`Error: No project found with id: ${opts.project}`);
            } else {
                pinoLogger.error('Error: No project found');
            }
            process.exit(1);
        }
        console.log('');
        pinoLogger.info(`Operating on project${projectsToOperateOn.length === 1 ? '' : 's'}:`);
        for (const project of projectsToOperateOn) {
            pinoLogger.info(`    * ${project.id}`);
        }

        config.projects = projectsToOperateOn;

        for (const project of config.projects) {
            for (const job of project.jobs) {
                const { runOnceForProject } = job;
                if (runOnceForProject) {
                    project.branches = [
                        ...project.branches,
                        '{project-level-jobs}'
                    ];
                }
            }
        }

        console.log('');
        pinoLogger.trace('Applied configuration:');
        pinoLogger.trace(pinoJsonBeautifier(config));

        const parentDirectory = `/var/tmp/revisitor/${addAtLocation}`;

        if (opts.add) {
            await $(execaConfig)`mkdir -p ${parentDirectory}`;
            process.chdir(parentDirectory);
            const cwd = process.cwd();
            pinoLogger.debug(`Current working directory: ${cwd}`);

            for (const project of config.projects) {
                const projectId = project.id;
                const projectUrl = project.url;

                const configInDirectory = path.dirname(configPath);
                const urlOrPath = (
                    projectUrl.indexOf('git@')   === 0 ||
                    projectUrl.indexOf('git:')   === 0 ||
                    projectUrl.indexOf('ftp:')   === 0 ||
                    projectUrl.indexOf('ftps:')  === 0 ||
                    projectUrl.indexOf('https:') === 0
                ) ?
                    projectUrl :
                    path.resolve(configInDirectory, projectUrl);

                const targetDirectoryPath = path.resolve(parentDirectory, projectId);
                if (fs.existsSync(targetDirectoryPath)) {
                    pinoLogger.warn(`Warning: Contents already exist at ${targetDirectoryPath}. Skipping cloning for the project "${projectId}".`);
                } else {
                    pinoLogger.info(`Cloning project: ${projectId}`);
                    await $(execaConfig)`git clone ${urlOrPath} ${projectId}`;
                    pinoLogger.info(`Cloned project: ${projectId}`);
                }
                process.chdir(projectId);

                const cwd = process.cwd();
                pinoLogger.info(`The Git project is available at: ${cwd}`);

                await $(execaConfig)`git fetch`;

                const { branches } = project;
                const branch = branches[0];
                await $(execaConfig)`git checkout ${branch}`;

                await $(execaConfig)`git reset --hard origin/${branch}`;
            }
        }

        const callMainExecution = async function ({ source }) {
            await mainExecution({
                $,

                config,

                source,

                addAtLocation,

                reportContents_project,
                reportContents_branch,
                reportContents_job,

                reportSend_runner,
                reportSend_project,
                reportSend_branch,

                reportDuration,
                reporters,

                runAndReport,
                projects: config.projects
            });
        };

        if (opts.cron) {
            for (const cron of crons) {
                schedule.scheduleJob(cron, function () {
                    (async () => {
                        await callMainExecution({
                            source: 'cron'
                        });
                    })();
                });
            }
        }

        if (opts.execute) {
            await callMainExecution({
                source: 'command'
            });
        }

        if (opts.remove) {
            await $(execaConfig)`mkdir -p ${parentDirectory}`;
            process.chdir(parentDirectory);
            const cwd = process.cwd();
            pinoLogger.debug(`Current working directory: ${cwd}`);

            const fsEntityExists = async function (path) {
                try {
                    const stats = await fs.promises.stat(path); // eslint-disable-line no-unused-vars
                    return [null, true];
                } catch (err) {
                    if (err.code === 'ENOENT') {
                        return [null, false];
                    } else {
                        return [err];
                    }
                }
            };

            for (const project of config.projects) {
                const projectId = project.id;

                try {
                    // DEV-HELPER:
                    //     To cause an error, first make a directory immutable by:
                    //         $ sudo chattr +i /path/to/directory
                    //     Then, attempting to remove it will cause an error.
                    //     To remove the immutable flag, use:
                    //         $ sudo chattr -i /path/to/directory

                    const [err, existed] = await fsEntityExists(projectId);
                    if (err) {
                        throw err;
                    }

                    await $(execaConfig)`rm -rf ${projectId}`;
                    pinoLogger.info(
                        `Removed project: ${projectId}` +
                        chalk.gray(existed ? ' (project path existed)' : ' (project directory did not exist)')
                    );
                } catch (err) {
                    pinoLogger.error(`Error in removing project: ${projectId}`);
                    pinoLogger.error(err);
                }
            }
        }
    }
})();
