import React from 'react';
import propTypes from 'prop-types';

import Switch from '@mui/material/Switch/index.js';
import Button from '@mui/material/Button/index.js';
import Input from '@mui/material/Input/index.js';
import DeleteIcon from '@mui/icons-material/Delete.js';
import AddIcon from '@mui/icons-material/Add.js';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import cronstrue from 'cronstrue';
import cronParser from 'cron-parser';

import { toast } from '../../../../../../ImportedComponents/react-toastify.js';

import { patchTask } from '../../../../../dal.js';
import { safeArrayPromiseToErrorPromise } from '../../../../../utils/safeArrayPromiseToErrorPromise.js';

const AddCron = function ({ crons, onCronBeingAdded, isPending }) {
    const [cronValue, setCronValue] = React.useState('');

    const handleSubmit = function () {
        if (!cronValue.trim()) {
            return;
        }
        // NOTE: At the time of adding this code, this function (`cronParser.parseString`) is not described
        //       in the official documentation.
        if (!cronParser.parseString(cronValue).expressions.length) {
            toast.error('Error - Invalid cron expression');
            return;
        }
        for (const cron in crons) {
            if (cron === cronValue) {
                toast.error('Error - Cron already exists');
                return;
            }
        }
        onCronBeingAdded(cronValue);
    };

    return (
        <div>
            <div>
                <Input
                    type="text"
                    placeholder="Enter cron expression"
                    value={cronValue}
                    spellCheck={false}
                    style={{
                        fontFamily: 'monospace',
                        fontSize: 11
                    }}
                    onChange={function (e) {
                        setCronValue(e.target.value);
                    }}
                    onKeyPress={function (e) {
                        if (!cronValue.trim() || isPending) {
                            return;
                        }
                        if (e.key === 'Enter') {
                            handleSubmit();
                        }
                    }}
                />
                <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    color="primary"
                    size="small"
                    disabled={!cronValue.trim() || isPending}
                    style={{ marginLeft: 20 }}
                    onClick={function () {
                        handleSubmit();
                    }}
                >
                    Add cron
                </Button>
            </div>
            <div style={{ marginTop: 5, color: '#777', fontStyle: 'italic', fontSize: 11 }}>
                {(() => {
                    try {
                        if (!cronValue.trim()) {
                            return null;
                        }

                        const description = cronstrue.toString(cronValue, { verbose: true });
                        return description;
                    } catch (e) {
                        return 'Invalid cron expression';
                    }
                })()}
            </div>
        </div>
    );
};
AddCron.propTypes = {
    crons: propTypes.object,
    onCronBeingAdded: propTypes.func.isRequired,
    isPending: propTypes.bool.isRequired
};

const Crons = function ({ detailedView, taskId, crons }) {
    const queryClient = useQueryClient();

    const {
        mutate,
        isPending
    } = useMutation({
        mutationFn: (newCronsOb) => {
            const p = patchTask({
                taskId,
                crons: newCronsOb
            });
            const querifiedP = safeArrayPromiseToErrorPromise(p);
            return querifiedP;
        },

        // eslint-disable-next-line no-unused-vars
        onSuccess: function (data, newCronsOb, context) {
            queryClient.setQueryData(['tasksList'], (oldData) => {
                const newData = structuredClone(oldData);
                newData.forEach(function (task) {
                    if (task._id === taskId) {
                        task.crons = newCronsOb;
                    }
                });

                return newData;
            });
        },

        // eslint-disable-next-line no-unused-vars
        onError: function (error, variables, context) {
            toast.error('Error - Failed to update cron');
        }
    });

    const enableDisableCron = function (cron, enable) {
        const newCronsOb = structuredClone(crons);
        newCronsOb[cron] = enable;
        mutate(newCronsOb); // Note: This is an async operation
    };

    const deleteCron = function (cron) {
        const newCronsOb = structuredClone(crons);
        delete newCronsOb[cron];
        mutate(newCronsOb); // Note: This is an async operation
    };

    return (
        <div>
            <div
                style={{
                    // Note: Using smooth `opacity` transition to avoid the flickering issue when the `isPending` state
                    //       changes very quickly (due to the network request being fast).
                    transition: 'opacity 0.5s',
                    opacity: isPending ? 0.5 : undefined
                }}
            >
                {Object.keys(crons).length === 0 && (
                    <div
                        style={{
                            marginTop: detailedView ? 10 : 0,
                            marginBottom: detailedView ? 10 : 0,
                            color: '#777',
                            fontStyle: 'italic',
                            fontSize: 12
                        }}
                    >
                        No crons
                    </div>
                )}
                {Object.keys(crons).map(function (cron, index) {
                    return (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                marginTop: (detailedView && index > 0) ? 5 : 0
                            }}
                        >
                            {
                                detailedView &&
                                <div
                                    style={{
                                        marginRight: 5
                                    }}
                                >
                                    <Button
                                        color="error"
                                        variant="outlined"
                                        startIcon={<DeleteIcon />}
                                        size="small"
                                        disabled={isPending}
                                        onClick={function () {
                                            deleteCron(cron);
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            }
                            <Switch
                                checked={crons[cron]}
                                size="small"

                                // Note: Not using `disabled` prop and rather using CSS pointer-events for disabling it to
                                //       avoid the flickering issue when the `disabled` prop is toggled and the network
                                //       request is in progress. If the network request completes very quickly, the
                                //       flickering issue can be observed.
                                // disabled={isPending}
                                style={{ pointerEvents: isPending ? 'none' : undefined }}

                                onChange={function (e) {
                                    enableDisableCron(cron, e.target.checked);
                                }}
                            />

                            <div
                                title={cronstrue.toString(cron, { verbose: true })}
                                style={{
                                    marginLeft: 5,
                                    alignContent: 'center',
                                    fontFamily: 'monospace',
                                    fontSize: 11
                                }}
                            >
                                {cron}
                            </div>
                        </div>
                    );
                })}
            </div>
            {
                detailedView &&
                <div style={{ marginTop: 10, marginBottom: 10 }}>
                    <AddCron
                        isPending={isPending}
                        crons={crons}
                        onCronBeingAdded={function (newCronValue) {
                            const newCronsOb = structuredClone(crons);
                            newCronsOb[newCronValue] = true;
                            mutate(newCronsOb); // Note: This is an async operation
                        }}
                    />
                </div>
            }
        </div>
    );
};
Crons.propTypes = {
    detailedView: propTypes.bool,
    taskId: propTypes.string.isRequired,
    crons: propTypes.object
};

export { Crons };
