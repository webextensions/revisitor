#!/usr/bin/env node

const path = require('node:path');

const { logger } = require('note-down');

const { program } = require('commander');

program
    .option('--config <config>')
    .option('--execute [project]');

program.parse();

const opts = program.opts();

const cwd = process.cwd();
const configPath = path.resolve(cwd, opts.config);

logger.info(`Loading config from: ${configPath}`);
const config = require(configPath);

if (opts.execute) {
    if (typeof opts.execute === 'string') {
        const matchingProjects = config.projects.filter((project) => project.id === opts.execute);

        if (matchingProjects.length === 0) {
            logger.error(`No project found with id: ${opts.execute}`);
            process.exit(1);
        }

        config.projects = matchingProjects;
    }

    if (config.projects.length === 0) {
        logger.error('No projects found to execute');
        process.exit(1);
    }

    for (const project of config.projects) {
        project.branches = (
            project.branches?.useByRunner ||
            config.branches?.useByRunner ||
            project.branches?.recommendedByProject ||
            config.branches?.fallbackByRunner
        );
        delete config.branches;

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

    logger.info('Configuration:');
    logger.json(config);
}

logger.warn('TODO: A task runner for your git projects to execute jobs at regular intervals and generate reports / alerts / notifications / mails');
