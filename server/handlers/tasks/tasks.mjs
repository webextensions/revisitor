// TODO: FIXME: If a project is schedule, but not setup, then its execution wouldn't work

import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

import express from 'express';

import cronstrue from 'cronstrue';

import Datastore from '@seald-io/nedb';
import {
    sendErrorResponse,
    sendSuccessResponse,
    sendSuccessResponseAsAccepted
} from '../../utils/express-utils/express-utils.mjs';

import notifier from '../../../utils/notifications/notifications.mjs';

import { pinoLogger } from './runner/utils/pinoLogger.mjs';
import { setCronSchedule } from './runner/utils/cronSchedule.mjs';

import { runner } from './runner/runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

const db = new Datastore({
    filename: path.resolve(__dirname, '../../../app-data/tasks.db'),
    autoload: true
});

const createTask = async function ({ configPath, enableRecommendedCrons }) {
    try {
        const config = require(configPath);

        const crons = {};

        if (config?.runAndReport?.recommendedCrons) {
            const recommendedCrons = config.runAndReport.recommendedCrons;
            for (const cron of recommendedCrons) {
                crons[cron] = !!enableRecommendedCrons;
            }
        }
        const taskToInsert = {
            configPath,
            crons,
            createdAt: new Date()
        };
        const newDoc = await db.insertAsync(taskToInsert);
        return [null, newDoc];
    } catch (err) {
        return [err];
    }
};

const getTask = async function ({ taskId }) {
    try {
        const task = await db.findOneAsync({ _id: taskId });

        if (!task) {
            return [new Error('Task not found')];
        } else {
            return [null, task];
        }
    } catch (err) {
        return [err];
    }
};

const ensureDatabaseSetup = async function () {
    try {
        await db.loadDatabaseAsync();
        await db.ensureIndexAsync({ fieldName: 'configPath', unique: true });
        return [null];
    } catch (e) {
        console.error(e);
        notifier.error('Error in Ensure Index', 'Could not ensure index on "configPath" field');
        return [e];
    }
};

const setupCrons = async function (entries) {
    try {
        for (const entry of entries) {
            const { configPath } = entry;
            const config = require(configPath);

            const cronsToCheck = entry.crons || {};

            const enabledCrons = {};

            for (const cron in cronsToCheck) {
                if (cronsToCheck[cron]) {
                    enabledCrons[cron] = true;
                }
            }

            if (Object.keys(enabledCrons).length === 0) {
                continue;
            }

            const [errGetCallMainExecution, doCallMainExecution] = await runner({
                taskConfig: config,
                configPath,
                purpose: 'schedule'
            });
            if (errGetCallMainExecution) {
                console.error('Error in getting callMainExecution');
                console.error(errGetCallMainExecution);
                throw errGetCallMainExecution;
            }

            global.scheduledJobs = global.scheduledJobs || {};

            for (const cron in enabledCrons) {
                const scheduleId = setCronSchedule({
                    cronStr: cron,
                    fn: async function () {
                        const [err] = await doCallMainExecution({
                            source: 'cron'
                        });
                        if (err) {
                            console.error(err);
                            notifier.error('Error in Task Execution', 'Error in Task Execution');
                        }
                    }
                });
                global.scheduledJobs[configPath] = global.scheduledJobs[configPath] || {};
                global.scheduledJobs[configPath][cron] = scheduleId;

                pinoLogger.info(`Scheduled cron: ${cronstrue.toString(cron, { verbose: true })} for tasks provided at ${configPath}`);
            }
        }
        return [null];
    } catch (err) {
        console.error(err);
        console.error('Error in Crons Setup - Could not setup crons');
        notifier.error('Error in Crons Setup', 'Could not setup crons');
        return [err];
    }
};

const setupAllCrons = async function () {
    try {
        const entries = (
            await db
                .find({})
                .sort({ createdAt: 1 })
        );
        const [err] = await setupCrons(entries);
        if (err) {
            throw err;
        }
        return [null];
    } catch (err) {
        console.error(err);
        console.error('Error in Crons Setup - Could not setup crons');
        notifier.error('Error in Crons Setup', 'Could not setup crons');
        return [err];
    }
};

const setupTasksRoutes = async function () {
    const [err] = await ensureDatabaseSetup();
    if (err) {
        console.error(err);
        notifier.error('Error in Database Setup', 'Could not setup database');
        throw err;
    }

    const [errSetupCrons] = await setupAllCrons();

    if (errSetupCrons) {
        console.error(err);
        notifier.error('Error in Crons Setup', 'Could not setup crons');
        throw err;
    }

    /*
    const triggerJobSchedules = async function () {
        const entries = await db.find({}).sort({ configPath: 1 });

        for (const entry of entries) {
            const { configPath } = entry;
            const config = require(configPath);

            const [err, doCallMainExecution] = await runner({
                taskConfig: config,
                configPath
            });
            await doCallMainExecution();
        }
    };
    await triggerJobSchedules();
    /* */

    const router = (
        express.Router()
            .get('/list', async function (req, res) {
                const entries = await db.find({}).sort({ configPath: 1 });
                return sendSuccessResponse(res, entries);
            })
            .get('/count', async function (req, res) {
                const count = await db.countAsync({});
                return sendSuccessResponse(res, count);
            })
            .post('/create', async function (req, res) {
                try {
                    const input = req.body;

                    const {
                        configPath,
                        enableRecommendedCrons
                    } = input;

                    const [err, newDoc] = await createTask({
                        configPath,
                        enableRecommendedCrons
                    });

                    if (err) {
                        if (err.errorType === 'uniqueViolated') {
                            return sendErrorResponse(res, 409, 'Task already exists');
                        } else {
                            console.error(err);
                            return sendErrorResponse(res, 500, 'Internal Server Error');
                        }
                    } else {
                        return sendSuccessResponse(res, newDoc);
                    }
                } catch (err) {
                    console.error(err);
                    return sendErrorResponse(res, 500, 'Internal Server Error');
                }
            })
            .post('/patch/:taskId', async function (req, res) {
                try {
                    const { taskId } = req.params;
                    const input = req.body;

                    const { crons } = input;

                    const [err, task] = await getTask({ taskId });
                    if (err) {
                        console.error(err);
                        return sendErrorResponse(res, 500, 'Internal Server Error');
                    }

                    const taskCloned = structuredClone(task);
                    taskCloned.crons = crons;

                    // eslint-disable-next-line no-unused-vars
                    const numUpdated = await db.updateAsync({ _id: taskId }, taskCloned, {});
                    return sendSuccessResponse(res, taskCloned);
                } catch (err) {
                    console.error(err);
                    return sendErrorResponse(res, 500, 'Internal Server Error');
                }
            })
            .post('/trigger', async function (req, res) {
                try {
                    const {
                        taskId,
                        waitForCompletion
                    } = req.body;

                    const task = await db.findOneAsync({ _id: taskId });
                    if (!task) {
                        return sendErrorResponse(res, 404, 'Task not found');
                    }

                    const { configPath } = task;

                    const config = require(configPath);

                    const fn = async function () {
                        // TODO: FIXME: Handle error
                        // eslint-disable-next-line no-unused-vars
                        const [errRunner, doCallMainExecution] = await runner({
                            taskConfig: config,
                            configPath,
                            purpose: 'execute'
                        });
                        // TODO: FIXME: Handle error
                        await doCallMainExecution({ source: 'command' });
                    };

                    if (waitForCompletion) {
                        await fn();
                        return sendSuccessResponse(res, 'Completed');
                    } else {
                        (async () => {
                            await fn();
                        })();
                        return sendSuccessResponseAsAccepted(res, 'Accepted');
                    }
                } catch (err) {
                    console.error(err);
                    return sendErrorResponse(res, 500, 'Internal Server Error');
                }
            })
            .post('/delete/:taskId', async function (req, res) {
                try {
                    const { taskId } = req.params;
                    const numRemoved = await db.removeAsync({ _id: taskId }, { multi: false });
                    return sendSuccessResponse(res, numRemoved);
                } catch (err) {
                    console.error(err);
                    return sendErrorResponse(res, 500, 'Internal Server Error');
                }
            })
    );

    return router;
};

export { setupTasksRoutes };
