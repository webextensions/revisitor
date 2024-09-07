import React, { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '../../../../../ImportedComponents/react-toastify.js';

import Input from '@mui/material/Input/index.js';
import Button from '@mui/material/Button/index.js';
import AddIcon from '@mui/icons-material/Add.js';

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
            const p = createTask({
                configPath: configPath.trim(),
                enableRecommendedCrons: true // TODO: HARDCODING: Provide a UI option to toggle this
            });
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
        <div
            className={styles.AddConfig}
            style={{ display: 'flex' }}
        >
            <div style={{ flex: 1 }}>
                <Input
                    type="text"
                    placeholder="Add new configuration file by providing its full path"
                    value={configPath}
                    spellCheck={false}
                    style={{
                        marginTop: 10,
                        paddingLeft: 21,
                        width: '100%',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        letterSpacing: 'unset'
                    }}
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
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    size="small"
                    disabled={isLoading || !configPath}
                    style={{ marginLeft: 20 }}
                    onClick={function () {
                        mutate();
                    }}
                >
                    {isLoading ? 'Adding...' : 'Add'}
                </Button>
            </div>
        </div>
    );
};

export { AddConfig };
