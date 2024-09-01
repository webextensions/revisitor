import React, { useState, useEffect } from 'react';
import propTypes from 'prop-types';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Loading } from '../../../../../ImportedComponents/Loading/Loading.js';

import { errAndDataArrayToPromise } from '../../../../utils/errAndDataArrayToPromise.js';
import {
    listTasks,
    deleteTask
} from '../../../../dal.js';

import { AddConfig } from '../AddConfig/AddConfig.js';

const DeleteTask = ({ taskId, onDelete }) => {
    const {
        refetch,
        status,
        fetchStatus
    } = useQuery({
        enabled: false,
        queryKey: ['deleteTask', taskId],
        queryFn: () => {
            const p = errAndDataArrayToPromise(deleteTask, [taskId]);
            return p;
        }
    });

    if (status === 'success') {
        return <div>Deleted</div>;
    }
    return (
        <button
            disabled={fetchStatus === 'fetching'}
            onClick={async () => {
                await refetch();
                onDelete();
            }}
        >
            {fetchStatus === 'fetching' ? 'Deleting...' : 'Delete'}
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
                cursor: deleted ? 'not-allowed' : 'pointer',
                opacity: deleted ? 0.5 : undefined
            }}
        >
            <td>{task.input}</td>
            <td>{task.createdAt}</td>
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
                    <th>Name</th>
                    <th>Created At</th>
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
            const p = errAndDataArrayToPromise(listTasks);
            return p;
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
