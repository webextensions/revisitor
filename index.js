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

const { pinoLogger } = require('./utils/pinoLogger.js');
const { formatLine } = require('./utils/formatLine.js');
const { generateProjectReport } = require('./utils/generateProjectReport.js');

const { sendSlackMessage } = require('./reporters/slack/sendSlackMessage.js');
const { sendMail } = require('./reporters/mail/sendMail.js');

const { program } = require('commander');

program
    .option('--config  <config>')
    .option('--add     [project]')
    .option('--execute [project]')
    .option('--start   [project]')
    .option('--stop    [project]')
    .option('--remove  [project]');

program.parse();

const opts = program.opts();

const cwd = process.cwd();
pinoLogger.debug(`Current working directory: ${cwd}`);
const configPath = path.resolve(cwd, opts.config);

pinoLogger.info(`Loading config from: ${configPath}`);
const config = require(configPath);

const logAndStore = function (arr, reportType, message) {
    const format = 'console';
    const formattedMessage = formatLine(format, reportType, message);

    console.log(formattedMessage);

    arr.push([reportType, message]);
};

const getLogOrWarnOrSkipWarnOrError = function ({
    reportContents_job, // 'always' (default) / 'onIssue'
    limit,              // <object>
    deltaDirection,     // 'increment' / 'decrement'
    count,              // <number> for this execution
    lastExecutionCount  // <number> for the last execution
}) {
    if (
        limit &&
        limit.error &&
        (
            (deltaDirection === 'increment' && count >= limit.error) ||
            (deltaDirection === 'decrement' && count <= limit.error)
        )
    ) {
        return 'error';
    } else if (
        limit &&
        typeof limit.warn === 'number' &&
        (
            (deltaDirection === 'increment' && count >= limit.warn) ||
            (deltaDirection === 'decrement' && count <= limit.warn)
        )
    ) {
        let computedSkipWarningWhenFollowingLimit = limit.warn;

        if (
            typeof lastExecutionCount === 'number' &&
            (
                (deltaDirection === 'increment' && lastExecutionCount >= limit.warn) ||
                (deltaDirection === 'decrement' && lastExecutionCount <= limit.warn)
            )
        ) {
            computedSkipWarningWhenFollowingLimit = (
                (
                    lastExecutionCount - (lastExecutionCount % limit.warnIncrement)
                ) +
                limit.warnIncrement
            );
        }

        if (
            (deltaDirection === 'increment' && count >= computedSkipWarningWhenFollowingLimit) ||
            (deltaDirection === 'decrement' && count <= computedSkipWarningWhenFollowingLimit)
        ) {
            return 'warn';
        } else {
            return 'skipWarn';
        }
    } else {
        return 'log';
    }
};

const submitReports = async function ({
    reportContents_job,
    reportContents_project,

    reportSend_project,
    reportSend_runner,

    reporters,

    runAndReport,

    forProject,
    forRunner
}) {
    // console.log('reporters:');
    // logger.json(reporters);

    // console.log('forProject:');
    // logger.json(forProject);

    // console.log('forRunner:');
    // logger.json(forRunner);

    if (!forProject && !forRunner) {
        console.error(chalk.red(` ✗ Unknown report type. Exiting...`));
        process.exit(1);
    }

    debugger;

    // const reportConfig = {
    const reportContents = {
        // 'always' (default) / 'onSkipWarn+' / 'onWarn+' / 'onError'
        job:     'always',
        // job:     'onSkipWarn+',
        // job:     'onWarn+',

        // 'always' (default) / 'onSkipWarn+' / 'onWarn+' / 'onError'
        project: 'onSkipWarn+'
    };

    debugger;

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
                runner: forRunner,
                project: forProject
            },
            reportContents,
            formatToUse
        );

        pinoLogger.debug('Generated report:');
        pinoLogger.debug(generatedReport);

        switch (reporter.type) {
            case 'slack': {
                const webhookUrl = reporter.url;
                const message = generatedReport;

                const [err, warning, response] = await sendSlackMessage({
                    webhookUrl,
                    message
                });

                if (err) {
                    console.error(chalk.red(' ✗ Error in posting message to Slack:'));
                    console.error(chalk.red(`      Status: ${err.response?.status}`));
                    console.error(chalk.red(`      Body: ${err.response?.body}`));
                } else if (warning) {
                    console.warn(chalk.yellow(' ⚠️ Warning in posting message to Slack:'), warning);
                } else {
                    console.info(`\n ${chalk.green('✔')} Message posted to Slack successfully:`, response.body);
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
                            subject: 'Revisitor - ' + forProject.title,
                            body: generatedReport
                        }
                    );
                    if (err) {
                        console.error(chalk.red(' ✗ Error in mailing message:'), err);
                    } else if (warning) {
                        console.warn(chalk.yellow(' ⚠️ Warning in mailing message:'), warning);
                    } else {
                        console.info(`\n ${chalk.green('✔')} Message mailed successfully:`, status);
                    }
                } else {
                    console.error(chalk.red(' ✗ Unknown mail provider'));
                }

                break;
            }
            default: {
                console.error(chalk.red(` ✗ Unknown reporter type`));
            }
        }
    }
};

const mainExecution = async function ({
    $,

    source,

    addAtLocation,

    reportContents_job,
    reportContents_project,

    reportSend_project,
    reportSend_runner,

    reportDuration,
    reporters,

    runAndReport,
    projects
}) {
    const forRunner = {
        time: Date.now(),
        reports: []
    };

    for (const project of projects) {
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

        const oldExecutionStatsFileContents = fs.readFileSync(`${id}.json`, 'utf8');
        const oldStatusJson = (function () {
            try {
                return JSON.parse(oldExecutionStatsFileContents);
            } catch (err) {
                return [];
            }
        })();
        const forProject_status_lastExecution = oldStatusJson[oldStatusJson.length - 1];

        process.chdir(id);
        await $`pwd`;

        await $`git fetch`;

        for (const branch of project.branches) {
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
                await $`git checkout ${branch}`;
                await $`git reset --hard origin/${branch}`;
            }

            for (const job of project.jobs) {
                const {
                    type,
                    runOnceForProject,
                    runForBranches
                } = job;
                const computedJobId = job.type + (job.id ? ('-' + job.id) : '');

                if (runOnceForProject) {
                    if (branch !== '{project-level-jobs}') {
                        continue;
                    }
                } else {
                    if (branch === '{project-level-jobs}') {
                        continue;
                    }
                }

                if (
                    runForBranches &&
                    !runForBranches.includes(branch)
                ) {
                    continue;
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
                    await $`git remote prune origin`;
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
                        logAndStore(forJob.reports, 'error',    [{ indentLevel: 3 }, { color: 'red', message: `✗ Current branches count (${branchesCount}) >=  error limit (${options.limit.error})` }, ...durationToAppend]);
                    } else if (whatToDo === 'warn') {
                        logAndStore(forJob.reports, 'warn',     [{ indentLevel: 3 }, { color: 'yellow', message: `⚠️ Branches count: ${branchesCount} >=  ${options.limit.warn} (warning limit)` }, ...durationToAppend]);
                    } else if (whatToDo === 'skipWarn') {
                        logAndStore(forJob.reports, 'skipWarn', [{ indentLevel: 3 }, `✔ Branches count: ${branchesCount} >=  ${options.limit.warn} (warning limit - skipped threshold)`, ...durationToAppend]);
                    } else {
                        logAndStore(forJob.reports, 'log',      [{ indentLevel: 3 }, { color: 'green', message: '✔' }, ` Branches count: ${branchesCount}`, ...durationToAppend]);
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
                                await $`npm ${approach}`;
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
            }

            forBranch.duration = Date.now() - forBranch.time;

            forProject.reports.push(forBranch);
        }

        forProject.duration = Date.now() - forProject.time;

        forRunner.reports.push(forProject);

        if (source === 'cron') {
            process.chdir(`/var/tmp/revisitor/${addAtLocation}`);
            await $`touch ${id}.json`;

            const newStatusJson = structuredClone(oldStatusJson);
            newStatusJson.push(forProject_status);
            fs.writeFileSync(`${id}.json`, JSON.stringify(newStatusJson, null, '\t') + '\n');
        }

        if (reportSend_project !== 'no') {
            await submitReports({
                reportContents_job,
                reportContents_project,

                reportSend_project,
                reportSend_runner,

                reporters,

                runAndReport,

                forProject
            });
        }
    }

    if (reportSend_runner !== 'no') {
        await submitReports({
            reportContents_job,
            reportContents_project,

            reportSend_project,
            reportSend_runner,

            reporters,

            runAndReport,

            forRunner
        });
    }
};

(async () => {
    const { $ } = await import('execa');

    const addAtLocation = config.addAtLocation || 'git-projects-cache';

    const runAndReport           = config.runAndReport                  || {};

    const crons                  = runAndReport.crons                   || [];

    const reportContents_job     = runAndReport.reportContents?.job     || 'always';
    const reportContents_project = runAndReport.reportContents?.project || 'always';

    const reportSend_project     = runAndReport.reportSend?.project     || 'onWarn+';
    const reportSend_runner      = runAndReport.reportSend?.runner      || 'no';

    const reportDuration         = runAndReport.reportDuration          || false;
    const reporters              = runAndReport.reporters               || [];

    if (
        opts.execute ||
        opts.add     ||
        opts.start   ||
        opts.stop    ||
        opts.remove
    ) {
        const projectsToOperateOn = (
            (typeof opts.project === 'string') ?
                config.projects.filter((project) => project.id === opts.project) :
                config.projects
        );

        if (projectsToOperateOn.length === 0) {
            if (typeof opts.project === 'string') {
                logger.error(`\nError: No project found with id: ${opts.project}`);
            } else {
                logger.error('\nError: No project found');
            }
            process.exit(1);
        }
        logger.info(`\nOperating on project${projectsToOperateOn.length === 1 ? '' : 's'}:`);
        for (const project of projectsToOperateOn) {
            logger.info(`    * ${project.id}`);
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

        // logger.info('Applied configuration:');
        // logger.json(config);

        if (opts.add) {
            await $`mkdir -p /var/tmp/revisitor/${addAtLocation}`;

            for (const project of config.projects) {
                const {
                    id,
                    url
                } = project;

                const configInDirectory = path.dirname(configPath);
                const urlOrPath = (
                    url.indexOf('git@')   === 0 ||
                    url.indexOf('git:')   === 0 ||
                    url.indexOf('ftp:')   === 0 ||
                    url.indexOf('ftps:')  === 0 ||
                    url.indexOf('https:') === 0
                ) ?
                    url :
                    path.resolve(configInDirectory, url);

                process.chdir(`/var/tmp/revisitor/${addAtLocation}`);

                const targetDirectoryPath = path.resolve(`/var/tmp/revisitor/${addAtLocation}`, id);
                if (fs.existsSync(targetDirectoryPath)) {
                    logger.warn(`Warning: Contents already exist at ${targetDirectoryPath}. Skipping cloning for the project "${id}"`);
                } else {
                    await $`git clone ${urlOrPath} ${id}`;
                }
                process.chdir(id);

                await $`pwd`;

                await $`git fetch`;

                const { branches } = project;
                const branch = branches[0];
                await $`git checkout ${branch}`;

                await $`git reset --hard origin/${branch}`;
            }
        }

        const callMainExecution = async function ({ source }) {
            await mainExecution({
                $,

                source,

                addAtLocation,

                reportContents_job,
                reportContents_project,

                reportSend_project,
                reportSend_runner,

                reportDuration,
                reporters,

                runAndReport,
                projects: config.projects
            });
        };

        if (opts.start) {
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
    }
})();
