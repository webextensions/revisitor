import React, { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '../../../../../ImportedComponents/react-toastify.js';

import { safeArrayPromiseToErrorPromise } from '../../../../utils/safeArrayPromiseToErrorPromise.js';

import { createTask } from '../../../../dal.js';

import * as styles from './AddConfig.css';

const AddConfig = function () {
    const [configPath, setConfigPath] = useState('');

    const queryClient = useQueryClient();

    const {
        isLoading,
        mutate
    } = useMutation({
        mutationFn: function () {
            const p = createTask({ configPath });
            (async function () {
                const [err] = await p;
                if (err) {
                    const httpResponseStatus = err?.response?.status;
                    if (httpResponseStatus === 409) {
                        toast.error('Error - Configuration already exists');
                    } else {
                        toast.error('Error - Failed to add configuration');
                    }
                } else {
                    // TODO: HARDCODING: Get rid of this hardcoding ('tasksList')
                    queryClient.invalidateQueries(['tasksList']);
                    setConfigPath('');
                    toast.success('Configuration added successfully');
                }
            }());
            const querifiedP = safeArrayPromiseToErrorPromise(p);
            return querifiedP;
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
                            mutate();
                        }
                    }}
                />
            </div>
            <div>
                <button
                    type="button"
                    disabled={isLoading || !configPath}
                    onClick={function () {
                        mutate();
                    }}
                >
                    {isLoading ? 'Adding...' : 'Add'}
                </button>
            </div>
        </div>
    );
};

export { AddConfig };
