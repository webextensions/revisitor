import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '../../../../../ImportedComponents/react-toastify.js';

import { errAndDataArrayToPromise } from '../../../../utils/errAndDataArrayToPromise.js';

import { createTask } from '../../../../dal.js';

import * as styles from './AddConfig.css';

const AddConfig = function () {
    const [configPath, setConfigPath] = useState('');

    const queryClient = useQueryClient();

    const {
        // isPending,
        isLoading,
        // error,
        // data,
        // isFetched,
        refetch
    } = useQuery({
        enabled: false,
        queryKey: ['dummyData'],
        queryFn: function () {
            const p = errAndDataArrayToPromise(createTask, [configPath]);
            (async function () {
                try {
                    await p;
                    // TODO: HARDCODING: Get rid of this hardcoding ('tasksList')
                    queryClient.invalidateQueries(['tasksList']);
                    setConfigPath('');
                    toast.success('Configuration added successfully');
                } catch (error) {
                    const httpResponseStatus = error?.response?.status;
                    if (httpResponseStatus === 409) {
                        toast.error('Error - Configuration already exists');
                    } else {
                        toast.error('Error - Failed to add configuration');
                    }
                }
            }());
            return p;
        }
    });

    return (
        <div className={styles.AddConfig}>
            <div>
                <input
                    type="text"
                    placeholder="Provide the full path of the configuration file"
                    style={{ width: '80vw' }}
                    value={configPath}
                    onChange={function (e) {
                        setConfigPath(e.target.value);
                    }}
                    onKeyPress={function (e) {
                        if (
                            e.key === 'Enter' &&
                            !isLoading &&
                            configPath
                        ) {
                            refetch();
                        }
                    }}
                />
            </div>
            <div>
                <button
                    type="button"
                    disabled={isLoading || !configPath}
                    onClick={function () {
                        refetch();
                    }}
                >
                    {isLoading ? 'Adding...' : 'Add'}
                </button>
            </div>
        </div>
    );
};

export { AddConfig };
