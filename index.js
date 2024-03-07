#!/usr/bin/env zx

const path = require('node:path');

const { program } = require('commander');

const {
    logger,
    noteDown
} = require('note-down');
noteDown.option('showLogLine', false);
const chalk = noteDown.chalk;


program
    .option('--config <config>')
    .option('--add [project]')
    .option('--execute [project]');

program.parse();

const opts = program.opts();

const cwd = process.cwd();
const configPath = path.resolve(cwd, opts.config);

logger.info(`Loading config from: ${configPath}`);
const config = require(configPath);

(async () => {
    const reportDuration = config.reportDuration || false;

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
        logger.info(`\nOperating on project${projectsToOperateOn.length === 1 ? '': 's'}:`);
        for (const project of projectsToOperateOn) {
            logger.info(`    * ${project.id}`);
        }

        config.projects = projectsToOperateOn;

        for (const project of config.projects) {
            project.branches = (
                project.branches?.useByRunner ||
                config.branches?.useByRunner ||
                project.branches?.recommendedByProject ||
                config.branches?.fallbackByRunner
            );
            delete config.branches;

            for (const job of project.jobs) {
                const { runOnceForProject } = job;
                if (runOnceForProject) {
                    project.branches = [
                        ...project.branches,
                        '<project-jobs-from-any-branch>'
                    ];
                }
            }

            project.crons = (
                project.crons?.useByRunner ||
                config.crons?.useByRunner ||
                project.crons?.recommendedByProject ||
                config.crons?.fallbackByRunner
            );
            delete config.crons;

            project.reporters = (
                project.reporters?.useByRunner ||
                config.reporters?.useByRunner ||
                project.reporters?.recommendedByProject ||
                config.reporters?.fallbackByRunner
            );
            delete config.reporters;
        }

        // logger.info('Applied configuration:');
        // logger.json(config);

        if (opts.add) {
            await $`mkdir -p /var/tmp/revisitor`;

            for (const project of config.projects) {
                const {
                    id,
                    url
                } = project;

                const configInDirectory = path.dirname(configPath);
                const urlOrPath = (
                    path.isAbsolute(url) ?
                        url :
                        path.resolve(configInDirectory, url)
                );

                cd('/var/tmp/revisitor');

                const targetDirectoryPath = path.resolve('/var/tmp/revisitor', id);
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

        if (opts.execute) {
            for (const project of config.projects) {
                const {
                    id,
                    title
                } = project;

                cd('/var/tmp/revisitor');
                cd(id);
                await $`pwd`;

                await $`git fetch`;

                logger.log(`\n➤ Project: ${title}`);
                for (const branch of project.branches) {
                    if (branch !== '<project-jobs-from-any-branch>') {
                        await $`git checkout ${branch}`.quiet();
                        await $`git reset --hard origin/${branch}`.quiet();
                    }

                    logger.log(`    ➤ Branch: ${branch}`);

                    for (const job of project.jobs) {
                        const {
                            type,
                            runOnceForProject,
                            runForBranches
                        } = job;

                        if (runOnceForProject) {
                            if (branch !== '<project-jobs-from-any-branch>') {
                                continue;
                            }
                        } else {
                            if (branch === '<project-jobs-from-any-branch>') {
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

                        if (type === 'gitBranchesCount') {
                            const { options } = job;
                            const { report } = options;

                            const t1 = Date.now();
                            await $`git remote prune origin`.quiet();
                            const branches = await $`git branch -r | grep -v "origin/HEAD" | wc -l`.quiet();
                            const t2 = Date.now();
                            let durationToAppend = '';
                            if (reportDuration) {
                                durationToAppend = chalk.dim(` (${t2 - t1}ms)`);
                            }
                            const branchesCount = parseInt(branches.stdout.trim());

                            if (
                                options.limit &&
                                options.limit.error &&
                                branchesCount >= options.limit.error
                            ) {
                                logger.error(`            ✗ Current branches count (${branchesCount}) >=  error limit (${options.limit.error})${durationToAppend}`);
                            } else if (
                                options.limit &&
                                options.limit.warn &&
                                branchesCount >= options.limit.warn
                            ) {
                                logger.warn(`            ⚠️ Branches count: ${branchesCount} >=  ${options.limit.warn} (warning limit)${durationToAppend}`);
                            } else if (report === 'always') {
                                logger.log(`            ${chalk.green('✔')} Branches count: ${branchesCount}${durationToAppend}`);
                            }
                        } else if (type === 'npmInstall') {
                            const { options } = job;
                            const {
                                report,
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
                            } catch (err) {
                                errorOccurred = true;
                            }

                            if (errorOccurred) {
                                logger.error(`            ✗ npm ${approach} failed in ${attemptInstance} attempt(s)`);
                            } else if (report === 'always') {
                                let durationToAppend = '';
                                if (reportDuration) {
                                    if (attemptInstance > 1) {
                                        durationToAppend = chalk.dim(` (${attemptDuration}ms / ${totalDuration}ms)`);
                                    } else {
                                        durationToAppend = chalk.dim(` (${attemptDuration}ms)`);
                                    }
                                }
                                logger.log(`            ${chalk.green('✔')} npm ${approach}${durationToAppend}`);
                            }
                        }
                    }
                }
            }
        }
    }
})();
