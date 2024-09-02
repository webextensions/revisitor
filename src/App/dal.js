import ky from 'ky';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const kyForApp = {
    // Setting `ky` instance internally, so that it can be updated in runtime (for development / debugging / testing purposes)
    instance: ky.create({
        timeout: 30000
    })
};

export const getDummyJsonData = async () => {
    await timeout(2000);
    return [null, {
        type: 'dummy',
        name: 'John Doe'
    }];
};

export const listTasks = async () => {
    try {
        const response = await kyForApp.instance.get('/tasks/list');
        const json = await response.json();
        return [null, json.output];
    } catch (err) {
        return [err, null];
    }
};

export const countTasks = async () => {
    try {
        const response = await kyForApp.instance.get('/tasks/count');
        const json = await response.json();
        return [null, json.output];
    } catch (err) {
        return [err, null];
    }
};

export const createTask = async (configPath) => {
    try {
        const response = await kyForApp.instance.post('/tasks/create', {
            json: {
                configPath
            }
        });
        const json = await response.json();
        return [null, json.output];
    } catch (err) {
        return [err, null];
    }
};

export const deleteTask = async (taskId) => {
    try {
        const response = await kyForApp.instance.delete(`/tasks/delete/${taskId}`);
        const json = await response.json();
        return [null, json.output];
    } catch (err) {
        return [err, null];
    }
};
