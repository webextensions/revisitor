import fs from 'node:fs';
import path from 'node:path';

import { $, execa } from 'execa';

import semver from 'semver';

import { htmlEscape } from 'helpmate/dist/misc/htmlEscape.cjs';
import { timeout } from 'helpmate/dist/scheduler/timeout.cjs';
import { tryCatchSafe } from 'helpmate/dist/control/tryCatch.cjs';

import {
    logger,
    noteDown
} from 'note-down';

import {
    pinoLogger,
    pinoJsonBeautifier
} from './utils/pinoLogger.mjs';

import notifier from '../../../../utils/notifications/notifications.mjs';

import { formatLine } from './appUtils/formatLine.js';
import { generateProjectReport } from './appUtils/generateProjectReport.js';
import { getLogOrWarnOrSkipWarnOrError } from './appUtils/getLogOrWarnOrSkipWarnOrError.js';
import { tagNodeVersions } from './appUtils/nodeOutdated/nodeOutdatedHelpers.js';

import { sendSlackMessage } from './reporters/slack/sendSlackMessage.js';
import { sendMail } from './reporters/mail/sendMail.js';

const chalk = noteDown.chalk;
noteDown.option('showLogLine', false);

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
const execaConfigWithCwd = function (cwd) {
    const config = {
        ...execaConfig,
        cwd
    };
    return config;
};
const execaWithRetryConfig = {
    attempts: 3,
    retryStrategy: {
        type: 'exponential',
        initialDelay: 2000,
        exponent: 2
    }
};

// Sometimes, the (`execa`) command fails with an error, but it may work if retried. This function assists in such cases.
// eg: An error like `error: cannot lock ref 'refs/remotes/origin/main': is at ...`
const execaWithRetry = async function (command, args, config, retryConfig) {
    const { attempts, retryStrategy } = retryConfig;

    let attempt = 0;
    let delay = retryStrategy.initialDelay;
    while (attempt < attempts) {
        try {
            const retValue = await execa(command, args, config);
            return retValue;
        } catch (err) {
            attempt++;
            if (attempt < attempts) {
                delay *= retryStrategy.exponent;
                await timeout(delay);
            } else {
                throw err;
            }
        }
    }
};

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
        // console.error(chalk.red(` ✗ Unknown report type. Exiting...`));
        // process.exit(1);
        console.error(chalk.red(` ✗ Error: Unknown report type`));
        return [new Error('Error: Unknown report type')];
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
    execaWithRetry,

    config,
    configPath,
    parentDirectory,

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
    try {
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

                const projectParentPath = `/var/tmp/revisitor/${addAtLocation}`;
                const projectPath =       `/var/tmp/revisitor/${addAtLocation}/${id}`;
                const projectJsonFilePath = path.resolve(projectParentPath, `${id}.json`);

                // eslint-disable-next-line no-unused-vars
                const [errFileRead, oldExecutionStatsFileContents] = tryCatchSafe(() => {
                    const output = fs.readFileSync(projectJsonFilePath, 'utf8');
                    return output;
                }, '[]');

                // eslint-disable-next-line no-unused-vars
                const [errJsonParse, oldStatusJson] = tryCatchSafe(() => {
                    const output = JSON.parse(oldExecutionStatsFileContents);
                    return output;
                }, []);
                const forProject_status_lastExecution = oldStatusJson[oldStatusJson.length - 1];

                try {
                    // Ensure that the directory exists and is a Git repository
                    await $(execaConfigWithCwd(projectParentPath))`git -C ${id} rev-parse`;
                } catch (e) {
                    const [errSetupGitRepo] = await setupGitRepo({
                        config,
                        configPath,
                        parentDirectory
                    });
                    if (errSetupGitRepo) {
                        throw new Error('Error in setting up Git repository', { cause: errSetupGitRepo });
                    }
                }

                await execaWithRetry('git', ['fetch'], execaConfigWithCwd(projectPath), execaWithRetryConfig);

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
                            await $(execaConfigWithCwd(projectPath))`git -c core.hooksPath=/dev/null checkout ${branch}`; // https://stackoverflow.com/questions/35447092/git-checkout-without-running-post-checkout-hook/61485071#61485071
                            await $(execaConfigWithCwd(projectPath))`git reset --hard origin/${branch}`;
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
                                    await $(execaConfigWithCwd(projectPath))`git remote prune origin`;
                                    const branches = await $(execaConfigWithCwd(projectPath))`git branch -r`.pipe`grep -v ${'origin/HEAD'}`.pipe`wc -l`;
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
                                        const nvmrcPath = path.resolve(projectPath, '.nvmrc');
                                        const nvmrcContents = fs.readFileSync(nvmrcPath, 'utf8'); // Read the .nvmrc file
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

                                    const flagSatisfied = semver.satisfies(semver.coerce(versionToEnsure).version, range);

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
                                    const outdated = await execaWithRetry('npx', ['--yes', 'npm-check-updates', '--jsonUpgraded'], execaConfigWithCwd(projectPath), execaWithRetryConfig);
                                    const t2 = Date.now();
                                    let durationToAppend = '';
                                    if (reportDuration) {
                                        durationToAppend = [' ', { dim: true, message: `(${t2 - t1}ms)` }];
                                    }

                                    let outdatedJsonObj;
                                    try {
                                        outdatedJsonObj = JSON.parse(outdated.stdout.trim());
                                    } catch (err) {
                                        console.log('Error in parsing stdout as JSON from `npm-check-updates`:');
                                        console.log(`stdout length: ${outdated.stdout} characters`);
                                        console.log(`stdout: ${outdated.stdout}`);
                                        console.log(`stderr length: ${outdated.stderr} characters`);
                                        console.log(`stderr: ${outdated.stderr}`);
                                        throw err;
                                    }
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
                                                await $(execaConfigWithCwd(projectPath))`npm ${approach}`;
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
                    await $(execaConfigWithCwd(projectParentPath))`touch ${projectJsonFilePath}`;

                    const newStatusJson = structuredClone(oldStatusJson);
                    newStatusJson.push(forProject_status);
                    fs.writeFileSync(projectJsonFilePath, JSON.stringify(newStatusJson, null, '\t') + '\n');
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

        return [null];
    } catch (e) {
        return [e];
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

const setupGitRepo = async function ({
    parentDirectory,
    config,
    configPath
}) {
    try {
        // Somehow, if CWD is not an existing directory (eg: It was deleted at some point of time after it was set),
        // then the following `mkdir -p <path>` command fails with ENOENT error. So, using '/' as the CWD to ensure that
        // the current directory is a valid one.
        await $(execaConfigWithCwd('/'))`mkdir -p ${parentDirectory}`;

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
                pinoLogger.warn(`Note: Contents already exist at ${targetDirectoryPath}. Skipping cloning for the project "${projectId}".`);
            } else {
                pinoLogger.info(`Cloning project: ${projectId}`);

                await $(execaConfigWithCwd(parentDirectory))`git clone ${urlOrPath} ${projectId}`;

                pinoLogger.info(`Cloned project: ${projectId}`);
            }

            pinoLogger.info(`The Git project is available at: ${targetDirectoryPath}`);

            await execaWithRetry('git', ['fetch'], execaConfigWithCwd(targetDirectoryPath), execaWithRetryConfig);

            const { branches } = project;
            const branch = branches[0];

            await $(execaConfigWithCwd(targetDirectoryPath))`git -c core.hooksPath=/dev/null checkout ${branch}`; // https://stackoverflow.com/questions/35447092/git-checkout-without-running-post-checkout-hook/61485071#61485071

            await $(execaConfigWithCwd(targetDirectoryPath))`git reset --hard origin/${branch}`;
        }
        return [null];
    } catch (e) {
        return [e];
    }
};

const runner = async ({ taskConfig, configPath, purpose }) => {
    const config = taskConfig;

    const addAtLocation = config.addAtLocation || 'git-projects-cache';

    const runAndReport           = config.runAndReport           || {};

    // const crons               = runAndReport.recommendedCrons || [];

    const reportContents_project = validateReportContentsOption(runAndReport.reportContents?.project, 'onWarn+');
    const reportContents_branch  = validateReportContentsOption(runAndReport.reportContents?.branch,  'onWarn+');
    const reportContents_job     = validateReportContentsOption(runAndReport.reportContents?.job,     'onWarn+');

    const reportSend_runner      = validateReportSendOption(runAndReport.reportSend?.runner,  'always' );
    const reportSend_project     = validateReportSendOption(runAndReport.reportSend?.project, 'onError');
    const reportSend_branch      = validateReportSendOption(runAndReport.reportSend?.branch,  'onError');

    const reportDuration         = runAndReport.reportDuration || false;
    const reporters              = runAndReport.reporters      || [];
    /* */

    // Just a code block
    {
        // const projectsToOperateOn = (
        //     (typeof opts.project === 'string') ?
        //         config.projects.filter((project) => project.id === opts.project) :
        //         config.projects
        // );
        const projectsToOperateOn = config.projects;

        if (projectsToOperateOn.length === 0) {
            console.log('');
            // if (typeof opts.project === 'string') {
            //     pinoLogger.error(`Error: No project found with id: ${opts.project}`);
            // } else {
            //     pinoLogger.error('Error: No project found');
            // }
            pinoLogger.error('Error: No project found');
            // process.exit(1);
            return [new Error('Error: No project found')];
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

        if (purpose === 'execute') {
            const [errSetupGitRepo] = await setupGitRepo({
                config,
                configPath,
                parentDirectory
            });
            if (errSetupGitRepo) {
                pinoLogger.error('setupGitRepo error:');
                pinoLogger.error(errSetupGitRepo);
                pinoLogger.error({
                    config,
                    configPath,
                    parentDirectory
                });
                notifier.error('Error in Git setup', `Could not setup Git repositories for ${configPath}`);
            }
        }

        const callMainExecution = async function ({ source }) {
            const [err, response] = await mainExecution({
                $,
                execaWithRetry,

                config,
                configPath,
                parentDirectory,

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
            return [err, response];
        };

        return [null, callMainExecution];
    }
};

export { runner };
