import ky from 'ky';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getDummyJsonData = async () => {
    await timeout(2000);
    return [null, {
        type: 'dummy',
        name: 'John Doe'
    }];
};

export const getDummyJsonDataNetwork = async () => {
    try {
        const response = await ky.get('/tasks/dummy').json();
        return [null, response];
    } catch (err) {
        return [err, null];
    }
};

export const listTasks = async () => {
    try {
        const response = await ky.get('/tasks/list').json();
        return [null, response.output];
    } catch (err) {
        return [err, null];
    }
};

export const countTasks = async () => {
    try {
        const response = await ky.get('/tasks/count').json();
        return [null, response.output];
    } catch (err) {
        return [err, null];
    }
};

export const createTask = async (task) => {
    try {
        const response = await ky.post('/tasks/create', {
            json: {
                input: task
            }
        }).json();
        return [null, response.output];
    } catch (err) {
        return [err, null];
    }
};

export const deleteTask = async (taskId) => {
    try {
        const response = await ky.delete(`/tasks/delete/${taskId}`).json();
        return [null, response.output];
    } catch (err) {
        return [err, null];
    }
};