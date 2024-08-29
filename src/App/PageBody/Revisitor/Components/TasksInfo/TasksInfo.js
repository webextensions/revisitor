import React, { useEffect } from 'react';
import propTypes from 'prop-types';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Loading } from '../../../../../ImportedComponents/Loading/Loading.js';

import { errAndDataArrayToPromise } from '../../../../utils/errAndDataArrayToPromise.js';
import { countTasks } from '../../../../dal.js';

const TasksInfo = ({ refreshedAt }) => {
    const {
        status,
        fetchStatus,
        data
    } = useQuery({
        queryKey: ['tasksCount'],
        queryFn: () => {
            const p = errAndDataArrayToPromise(countTasks);
            return p;
        }
    });

    const queryClient = useQueryClient();
    useEffect(() => {
        if (refreshedAt) {
            queryClient.invalidateQueries({
                queryKey: ['tasksCount'],
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
                    return `Count: ${JSON.stringify(data, null, 4)}`;
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
