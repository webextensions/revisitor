#!/usr/bin/env node

const { logger } = require('note-down');

const { program } = require('commander');

program
    .option('--config <config>')
    .option('--execute [project]');

program.parse();

const opts = program.opts();

console.log('opts.config', opts.config);
console.log('opts.execute', opts.execute);

logger.warn('TODO: A task runner for your git projects to execute jobs at regular intervals and generate reports / alerts / notifications / mails');
