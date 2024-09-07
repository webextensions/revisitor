import React, { useState, useEffect } from 'react';
import propTypes from 'prop-types';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@mui/material/Button/index.js';
import DeleteIcon from '@mui/icons-material/Delete.js';

import { CopyIcon } from '@webextensions/react/components/CopyIcon/CopyIcon.js';

import { Loading } from '../../../../../ImportedComponents/Loading/Loading.js';

import { RelativeTime } from '../../../../../base_modules/RelativeTime/RelativeTime.js';

import { safeArrayPromiseToErrorPromise } from '../../../../utils/safeArrayPromiseToErrorPromise.js';
import {
    listTasks,
    deleteTask
} from '../../../../dal.js';

import { AddConfig } from '../AddConfig/AddConfig.js';
import { Trigger } from './Trigger.js';
import { Crons } from './Crons.js';

import * as styles from './Tasks.css';

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
        <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            size="small"
            disabled={isPending}
            onClick={async () => {
                // eslint-disable-next-line no-alert
                const confirmed = window.confirm('Are you sure you want to delete this task?');
                if (confirmed) {
                    await mutate();
                    onDelete();
                }
            }}
        >
            {isPending ? 'Deleting...' : 'Delete'}
        </Button>
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
            <td style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex' }}>
                    <div>
                        <CopyIcon data={task.configPath} />
                    </div>
                    <div style={{ marginLeft: 5, fontFamily: 'monospace', fontSize: 11 }}>
                        {task.configPath}
                    </div>
                </div>
            </td>
            <td>
                <span title={String(new Date(task.createdAt))}>
                    <RelativeTime
                        type="past"
                        time={(new Date(task.createdAt)).getTime()}
                    />
                </span>
            </td>
            <td>
                <Trigger taskId={task._id} />
            </td>
            <td>
                <Crons taskId={task._id} crons={task.crons} />
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
        <table
            className={styles.TasksTable}
            style={{ width: '100%' }}
        >
            <thead>
                <tr>
                    <th>Configuration Path</th>
                    <th>Added</th>
                    <th>Trigger</th>
                    <th>Cron</th>
                    <th
                        style={{
                            // To ensure that the contents under this column don't have any padding, so, the right side
                            // of the "Delete" buttons inside the table are aligned with the right side of the "Add"
                            // button below the table
                            width: 1
                        }}
                    >
                        Actions
                    </th>
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
                    return (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Loading type="line-scale" />
                        </div>
                    );
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
            <div style={{ marginTop: 20 }}>
                <TasksList refreshedAt={refreshedAt} />
            </div>

            <div style={{ marginTop: 35 }}>
                <AddConfig />
            </div>
        </div>
    );
};
Tasks.propTypes = {
    refreshedAt: propTypes.number
};

export { Tasks };
