import React, { useState, useEffect, Fragment } from 'react';
import propTypes from 'prop-types';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import ArrowRightIcon from '@mui/icons-material/ArrowRight'; // eslint-disable-line node/file-extension-in-import
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'; // eslint-disable-line node/file-extension-in-import

import { CopyIcon } from '@webextensions/react/components/CopyIcon/CopyIcon.js';

import { Loading } from '../../../../../ImportedComponents/Loading/Loading.js';

import { RelativeTime } from '../../../../../base_modules/RelativeTime/RelativeTime.js';

import { safeArrayPromiseToErrorPromise } from '../../../../utils/safeArrayPromiseToErrorPromise.js';
import { listTasks } from '../../../../dal.js';

import { AddConfig } from '../AddConfig/AddConfig.js';
import { Trigger } from './Trigger/Trigger.js';
import { Crons } from './Crons/Crons.js';
import { DeleteTask } from './DeleteTask/DeleteTask.js';

import { ManageTask } from './ManageTask/ManageTask.js';

import * as styles from './Tasks.css';

const Task = ({ task }) => {
    const [showDetailedView, setShowDetailedView] = useState(false);

    const [deleted, setDeleted] = useState(false);
    const handleDelete = () => {
        setDeleted(true);
    };
    return (
        <Fragment>
            <tr
                style={{
                    height: 24,
                    opacity: deleted ? 0.5 : undefined,
                    boxShadow: showDetailedView ? 'unset' : undefined
                }}
                className={deleted ? 'no-pointer-events' : undefined}
            >
                <td style={{ textAlign: 'left' }}>
                    {
                        showDetailedView ?
                            <ArrowDropDownIcon style={{ cursor: 'pointer' }} onClick={() => setShowDetailedView(false)} /> :
                            <ArrowRightIcon style={{ cursor: 'pointer' }} onClick={() => setShowDetailedView(true)} />
                    }
                </td>
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
                    <div>
                        <DeleteTask taskId={task._id} onDelete={handleDelete} />
                    </div>
                </td>
            </tr>
            {
                showDetailedView &&
                <tr>
                    <td></td>
                    <td colSpan={5} style={{ height: 10, backgroundColor: '#f7f7f7', textAlign: 'left' }}>
                        <ManageTask
                            taskId={task._id}
                            crons={task.crons}
                        />
                    </td>
                </tr>
            }
        </Fragment>
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
                    <th />
                    <th>Configuration Path</th>
                    <th>Added</th>
                    <th>Trigger</th>
                    <th>Crons</th>
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
