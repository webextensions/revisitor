import React, { useEffect } from 'react';
import propTypes from 'prop-types';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Loading } from '../../../../../ImportedComponents/Loading/Loading.js';

import { errAndDataArrayToPromise } from '../../../../utils/errAndDataArrayToPromise.js';
import { listTasks } from '../../../../dal.js';

const TasksTable = ({ tasks }) => {
    return (
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Created At</th>
                </tr>
            </thead>
            <tbody>
                {tasks.map((task) => {
                    return (
                        <tr key={task._id}>
                            <td>{task._id}</td>
                            <td>{task.input}</td>
                            <td>{task.createdAt}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};
TasksTable.propTypes = {
    tasks: propTypes.array
};

const TasksInfo = ({ refreshedAt }) => {
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
TasksInfo.propTypes = {
    refreshedAt: propTypes.number
};

export { TasksInfo };
