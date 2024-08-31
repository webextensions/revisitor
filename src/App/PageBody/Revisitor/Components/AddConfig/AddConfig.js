import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { errAndDataArrayToPromise } from '../../../../utils/errAndDataArrayToPromise.js';

import { createTask } from '../../../../dal.js';

import * as styles from './AddConfig.css';

const AddConfig = function () {
    const [configPath, setConfigPath] = useState('');

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
                        if (e.key === 'Enter') {
                            refetch();
                        }
                    }}
                />
            </div>
            <div>
                <button
                    type="button"
                    disabled={isLoading}
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
