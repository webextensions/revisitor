import express from 'express';

import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import Datastore from '@seald-io/nedb';
import {
    sendErrorResponse,
    sendSuccessResponse
} from '../../utils/express-utils/express-utils.mjs';

// const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = new Datastore({
    filename: path.resolve(__dirname, '../../../app-data/tasks.db'),
    autoload: true
});

const setupTasksRoutes = async function () {
    await db.loadDatabaseAsync();
    const router = (
        express.Router()
            .get('/dummy', async function (req, res) {
                // await timeout(2000);

                // return res.send({
                //     type: 'dummy',
                //     name: 'John Doe',
                //     source: 'server'
                // });

                return sendSuccessResponse(res, {
                    type: 'dummy',
                    name: 'John Doe',
                    source: 'server'
                });
            })
            .get('/list', async function (req, res) {
                const entries = await db.find({});
                return sendSuccessResponse(res, entries);
            })
            .get('/count', async function (req, res) {
                const count = await db.countAsync({});
                return sendSuccessResponse(res, count);
            })
            .post('/create', async function (req, res) {
                // return res.status(501).send({ error: 'Not Implemented' });

                try {
                    const input = req.body;

                    const task = {
                        ...input,
                        createdAt: new Date()
                    };

                    const newDoc = await db.insertAsync(task);
                    console.log('newDoc:', newDoc);
                    return sendSuccessResponse(res, newDoc);
                } catch (err) {
                    console.error(err);
                    return sendErrorResponse(res, 500, 'Internal Server Error');
                }
            })
    );

    return router;
};

export { setupTasksRoutes };
