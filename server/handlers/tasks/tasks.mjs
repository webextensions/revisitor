import express from 'express';

import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import Datastore from '@seald-io/nedb';
import {
    sendErrorResponse,
    sendSuccessResponse
} from '../../utils/express-utils/express-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Datastore({
    filename: path.resolve(__dirname, '../../../app-data/tasks.db'),
    autoload: true
});

const setupTasksRoutes = async function () {
    await db.loadDatabaseAsync();
    const router = (
        express.Router()
            .get('/list', async function (req, res) {
                const entries = await db.find({}).sort({ input: 1 });
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
                    console.error(err);
                    return sendErrorResponse(res, 500, 'Internal Server Error');
                }
            })
            .delete('/delete/:taskId', async function (req, res) {
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
