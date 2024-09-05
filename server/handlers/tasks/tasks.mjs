import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

import express from 'express';

import Datastore from '@seald-io/nedb';
import {
    sendErrorResponse,
    sendSuccessResponse,
    sendSuccessResponseAsAccepted
} from '../../utils/express-utils/express-utils.mjs';

import notifier from '../../../utils/notifications/notifications.mjs';

import { runner } from './runner/runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

const db = new Datastore({
    filename: path.resolve(__dirname, '../../../app-data/tasks.db'),
    autoload: true
});

const createTask = async function ({ configPath }) {
    try {
        const config = require(configPath);
        let hasCrons = false;
        if (config?.runAndReport?.crons) {
            hasCrons = true;
        }
        const taskToInsert = {
            configPath,
            hasCrons,
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
        // FIXME: Check how the API works. In case the task does not exist, then an error should be returned
        return [null, task];
    } catch (err) {
        return [err];
    }
};

const setupTasksRoutes = async function () {
    await db.loadDatabaseAsync();
    try {
        await db.ensureIndexAsync({ fieldName: 'configPath', unique: true });
    } catch (e) {
        console.error(e);
        notifier.error('Error in Ensure Index', 'Could not ensure index on "configPath" field');
        throw e;
    }

    /*
    const triggerJobSchedules = async function () {
        const entries = await db.find({}).sort({ configPath: 1 });

        for (const entry of entries) {
            const { configPath } = entry;
            const config = require(configPath);

            await runner(config, configPath);
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

                    const { configPath } = input;

                    const [err, newDoc] = await createTask({ configPath });

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

                    const { hasCrons } = input;

                    const [err, task] = await getTask({ taskId });
                    if (err) {
                        console.error(err);
                        return sendErrorResponse(res, 500, 'Internal Server Error');
                    }

                    const taskCloned = structuredClone(task);
                    taskCloned.hasCrons = !!hasCrons;

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

                    if (waitForCompletion) {
                        await runner(config, configPath);
                        return sendSuccessResponse(res, 'Completed');
                    } else {
                        (async () => {
                            await runner(config, configPath);
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
