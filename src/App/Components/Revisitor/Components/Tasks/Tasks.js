import React, { useState, useEffect } from 'react';
import propTypes from 'prop-types';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Loading } from '../../../../../ImportedComponents/Loading/Loading.js';

import { safeArrayPromiseToErrorPromise } from '../../../../utils/safeArrayPromiseToErrorPromise.js';
import {
    listTasks,
    deleteTask
} from '../../../../dal.js';

import { AddConfig } from '../AddConfig/AddConfig.js';
import { Trigger } from './Trigger.js';
import { CronToggle } from './CronToggle.js';

const DeleteTask = ({ taskId, onDelete }) => {
    const {
        mutate,
        status,
        isPending
    } = useMutation({
        mutationFn: () => {
            const p = deleteTask({ taskId });
            const querifiedP = safeArrayPromiseToErrorPromise(p);
            return querifiedP;
        }
    });

    if (status === 'success') {
        return <div>Deleted</div>;
    }
    return (
        <button
            disabled={isPending}
            onClick={async () => {
                await mutate();
                onDelete();
            }}
        >
            {isPending ? 'Deleting...' : 'Delete'}
        </button>
    );
};
DeleteTask.propTypes = {
    taskId: propTypes.string,
    onDelete: propTypes.func
};

const Task = ({ task }) => {
    const [deleted, setDeleted] = useState(false);
    const handleDelete = () => {
        setDeleted(true);
    };
    return (
        <tr
            style={{
                height: 24,
                opacity: deleted ? 0.5 : undefined
            }}
            className={deleted ? 'no-pointer-events' : undefined}
        >
            <td>{task.configPath}</td>
            <td>{task.createdAt}</td>
            <td>
                <Trigger taskId={task._id} />
            </td>
            <td>
                <CronToggle taskId={task._id} hasCrons={task.hasCrons} />
            </td>
            <td>
                <DeleteTask taskId={task._id} onDelete={handleDelete} />
            </td>
        </tr>
    );
};
Task.propTypes = {
    task: propTypes.object
};

const TasksTable = ({ tasks }) => {
    if (!tasks.length) {
        return (
            <div style={{ fontStyle: 'italic', color: '#777' }}>
                There are no available tasks. Please add a task.
            </div>
        );
    }

    return (
        <table>
            <thead>
                <tr>
                    <th>Config Path</th>
                    <th>Created At</th>
                    <th>Trigger</th>
                    <th>Cron</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {tasks.map((task) => {
                    return <Task task={task} key={task._id} />;
                })}
            </tbody>
        </table>
    );
};
TasksTable.propTypes = {
    tasks: propTypes.array
};

const TasksList = ({ refreshedAt }) => {
    const {
        status,
        fetchStatus,
        data
    } = useQuery({
        queryKey: ['tasksList'],
        queryFn: () => {
            const p = listTasks();
            const querifiedP = safeArrayPromiseToErrorPromise(p);
            return querifiedP;
        }
    });

    const queryClient = useQueryClient();
    useEffect(() => {
        if (refreshedAt) {
            queryClient.invalidateQueries({
                queryKey: ['tasksList'],
                exact: true
            });
        }
    }, [refreshedAt]);

    return (
        <div
            style={{
                opacity: (fetchStatus === 'fetching') ? 0.5 : undefined,
                transition: (fetchStatus === 'fetching') ? undefined : 'opacity 0.3s'
            }}
        >
            {(() => {
                if (status === 'success') {
                    return <TasksTable tasks={data} />;
                } else if (status === 'error') {
                    return 'Error';
                } else {
                    return <Loading type="line-scale" />;
                }
            })()}
        </div>
    );
};
TasksList.propTypes = {
    refreshedAt: propTypes.number
};

const Tasks = function ({ refreshedAt }) {
    return (
        <div>
            <TasksList refreshedAt={refreshedAt} />

            <div style={{ marginTop: 20 }}>
                <AddConfig />
            </div>
        </div>
    );
};
Tasks.propTypes = {
    refreshedAt: propTypes.number
};

export { Tasks };
