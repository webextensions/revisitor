#!/usr/bin/env zx

/* eslint-disable filenames/no-index */

/* globals $, cd */

const path = require('node:path');
const fs = require('node:fs');

const { program } = require('commander');

const schedule = require('node-schedule');

// const { marked } = require('marked');
// const { markedTerminal } = require('marked-terminal');
// // marked.use(markedTerminal([options][, highlightOptions]));
// marked.use(markedTerminal());
// console.log(marked('# Hello \n This is **markdown** printed in the `terminal`'));

const {
    logger,
    noteDown
} = require('note-down');
noteDown.option('showLogLine', false);
const chalk = noteDown.chalk;

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
const configPath = path.resolve(cwd, opts.config);

logger.info(`Loading config from: ${configPath}`);
const config = require(configPath);

const logAndStore = function (arr, type, message) {
    let finalMessage = '';

    if (typeof message === 'string') {
        finalMessage = message;
    } else if (Array.isArray(message)) {
        for (const part of message) {
            if (part && typeof part === 'object') {
                const unwrappedPart = part.message || '';
                let wrappedPart = unwrappedPart;

                if (part.color) {
                    wrappedPart = chalk[part.color](wrappedPart);
                }
                if (part.dim) {
                    wrappedPart = chalk.dim(wrappedPart);
                }
                if (part.bold) {
                    wrappedPart = chalk.bold(wrappedPart);
                }

                if (part.indentLevel) {
                    wrappedPart = '    '.repeat(part.indentLevel) + wrappedPart;
                }

                finalMessage += wrappedPart;
            } else {
                finalMessage += part;
            }
        }
    }

    console.log(finalMessage);

    arr.push([type, message]);
};

/*
const flushLogStore = function (arr) {
    for (const [type, message] of arr) {
        if (type === 'log') {
            logger.log(message);
        } else if (type === 'error') {
            logger.error(message);
        } else if (type === 'warn') {
            logger.warn(message);
        }
    }
};
/* */

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

    forProject,
    forRunner
}) {
    // console.log('reporters:');
    // logger.json(reporters);

    // console.log('forProject:');
    // logger.json(forProject);

    // console.log('forRunner:');
    // logger.json(forRunner);

    /*
    for (const reportForProject of reportsForProjects) {
        console.log('Report for project:');
        console.log(reportForProject);

        for (const reporter of reporters) {
            switch (reporter.type) {
                case 'console': {
                    console.log('TODO: Implement console reporter');
                    break;
                }
                case 'file': {
                    console.log('TODO: Implement file reporter');
                    break;
                }
                case 'mail': {
                    console.log('TODO: Implement mail reporter');
                    break;
                }
                default: {
                    console.log('Unknown reporter type');
                }
            }
        }
    }
    /* */
};

const mainExecution = async function ({
    addAtLocation,

    reportContents_job,
    reportContents_project,

    reportSend_project,
    reportSend_runner,

    reportDuration,
    reporters,

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

        // const logsForProject = [];

        const forProject_status = {
            time: Date.now(),
            branches: {}
        };

        $.verbose = false;
        cd(`/var/tmp/revisitor/${addAtLocation}`);

        const oldExecutionStatsFileContents = fs.readFileSync(`${id}.json`, 'utf8');
        const oldStatusJson = (function () {
            try {
                return JSON.parse(oldExecutionStatsFileContents);
            } catch (err) {
                return [];
            }
        })();
        const forProject_status_lastExecution = oldStatusJson[oldStatusJson.length - 1];

        cd(id);
        $.verbose = true;
        // await $`pwd`;

        await $`git fetch`.quiet();

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

            if (branch !== '<project-level-jobs>') {
                await $`git checkout ${branch}`.quiet();
                await $`git reset --hard origin/${branch}`.quiet();
            }

            for (const job of project.jobs) {
                const {
                    type,
                    runOnceForProject,
                    runForBranches
                } = job;
                const computedJobId = job.type + (job.id ? ('-' + job.id) : '');

                if (runOnceForProject) {
                    if (branch !== '<project-level-jobs>') {
                        continue;
                    }
                } else {
                    if (branch === '<project-level-jobs>') {
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
                    await $`git remote prune origin`.quiet();
                    const branches = await $`git branch -r | grep -v "origin/HEAD" | wc -l`.quiet();
                    const t2 = Date.now();
                    let durationToAppend = '';
                    if (reportDuration) {
                        durationToAppend = { dim: true, message: ` (${t2 - t1}ms)` };
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
                        logAndStore(forJob.reports, 'error',    [{ indentLevel: 3 }, { color: 'red', message: `✗ Current branches count (${branchesCount}) >=  error limit (${options.limit.error})` }, durationToAppend]);
                    } else if (whatToDo === 'warn') {
                        logAndStore(forJob.reports, 'warn',     [{ indentLevel: 3 }, { color: 'yellow', message: `⚠️ Branches count: ${branchesCount} >=  ${options.limit.warn} (warning limit)` }, durationToAppend]);
                    } else if (whatToDo === 'skipWarn') {
                        logAndStore(forJob.reports, 'skipWarn', [{ indentLevel: 3 }, `✔ Branches count: ${branchesCount} >=  ${options.limit.warn} (warning limit - skipped threshold)`, durationToAppend]);
                    } else {
                        logAndStore(forJob.reports, 'log',      [{ indentLevel: 3 }, { color: 'green', message: '✔' }, ` Branches count: ${branchesCount}`, durationToAppend]);
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
                                await $`npm ${approach}`.quiet();
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
                                durationToAppend = { dim: true, message: ` (${attemptDuration}ms / ${totalDuration}ms)` };
                            } else {
                                durationToAppend = { dim: true, message: ` (${attemptDuration}ms)` };
                            }
                        }
                        logAndStore(forJob.reports, 'log', [{ indentLevel: 3 }, { color: 'green', message: '✔' }, ` npm ${approach}`, durationToAppend]);
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

        $.verbose = false;
        cd(`/var/tmp/revisitor/${addAtLocation}`);
        await $`touch ${id}.json`;
        $.verbose = true;

        const newStatusJson = structuredClone(oldStatusJson);
        newStatusJson.push(forProject_status);
        fs.writeFileSync(`${id}.json`, JSON.stringify(newStatusJson, null, '\t') + '\n');

        // logger.json(statusForProject);
        // logsForAllProjects.push({
        //     project: id,
        //     logs: logsForProject
        // });

        // console.log('Flushing the logs for this project');
        // flushLogStore(logsForProject);

        if (reportSend_project != 'no') {
            // Use logsForProject
            await submitReports({
                reportContents_job,
                reportContents_project,

                reportSend_project,
                reportSend_runner,

                reporters,

                forProject
            });
        }
    }

    // console.log(forRunner);

    // console.log('Flushing all the logs');
    // flushLogStore(logsForAllProjects);

    if (reportSend_runner != 'no') {
        await submitReports({
            reportContents_job,
            reportContents_project,

            reportSend_project,
            reportSend_runner,

            reporters,

            forRunner
        });
    }
};

(async () => {
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
                        '<project-level-jobs>'
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

                cd(`/var/tmp/revisitor/${addAtLocation}`);

                const targetDirectoryPath = path.resolve(`/var/tmp/revisitor/${addAtLocation}`, id);
                if (fs.existsSync(targetDirectoryPath)) {
                    logger.warn(`Warning: Contents already exist at ${targetDirectoryPath}. Skipping cloning for the project "${id}"`);
                } else {
                    await $`git clone ${urlOrPath} ${id}`;
                }
                cd(id);

                await $`pwd`;

                await $`git fetch`;

                const { branches } = project;
                const branch = branches[0];
                await $`git checkout ${branch}`;

                await $`git reset --hard origin/${branch}`;
            }
        }

        const callMainExecution = async function () {
            await mainExecution({
                addAtLocation,

                reportContents_job,
                reportContents_project,

                reportSend_project,
                reportSend_runner,

                reportDuration,
                reporters,

                projects: config.projects
            });
        };

        if (opts.start) {
            for (const cron of crons) {
                schedule.scheduleJob(cron, function () {
                    (async () => {
                        await callMainExecution();
                    })();
                });
            }
        }

        if (opts.execute) {
            await callMainExecution();
        }
    }
})();
