import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

import express from 'express';

import Datastore from '@seald-io/nedb';
import {
    sendErrorResponse,
    sendSuccessResponse
} from '../../utils/express-utils/express-utils.mjs';

import notifier from '../../../utils/notifications/notifications.mjs';

import { runner } from './runner/runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

const db = new Datastore({
    filename: path.resolve(__dirname, '../../../app-data/tasks.db'),
    autoload: true
});

const setupTasksRoutes = async function () {
    await db.loadDatabaseAsync();
    try {
        await db.ensureIndexAsync({ fieldName: 'configPath', unique: true });
    } catch (e) {
        console.error(e);
        notifier.error('Error in Ensure Index', 'Could not ensure index on "configPath" field');
        throw e;
    }

    const triggerJobSchedules = async function () {
        const entries = await db.find({}).sort({ configPath: 1 });

        for (const entry of entries) {
            const { configPath } = entry;
            const config = require(configPath);

            await runner(config);
        }
    };
    await triggerJobSchedules();

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

                    const task = {
                        ...input,
                        createdAt: new Date()
                    };

                    const newDoc = await db.insertAsync(task);
                    return sendSuccessResponse(res, newDoc);
                } catch (err) {
                    if (err.errorType === 'uniqueViolated') {
                        return sendErrorResponse(res, 409, 'Task already exists');
                    } else {
                        console.error(err);
                        return sendErrorResponse(res, 500, 'Internal Server Error');
                    }
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
