import React, { useState } from 'react';
import propTypes from 'prop-types';

import Switch from '@mui/material/Switch/index.js';
import { useMutation } from '@tanstack/react-query';

import cronstrue from 'cronstrue';

import { toast } from '../../../../../ImportedComponents/react-toastify.js';

import { patchTask } from '../../../../dal.js';
import { safeArrayPromiseToErrorPromise } from '../../../../utils/safeArrayPromiseToErrorPromise.js';

const Crons = function ({ taskId, crons }) {
    const [cronsOb, setCronsOb] = useState(crons);

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
            setCronsOb(newCronsOb);
        },

        // eslint-disable-next-line no-unused-vars
        onError: function (error, variables, context) {
            toast.error('Error - Failed to update cron');
        }
    });

    const enableDisableCron = function (cron, enable) {
        const newCronsOb = structuredClone(cronsOb);
        newCronsOb[cron] = enable;
        mutate(newCronsOb); // Note: This is an async operation
    };

    return (
        <div
            style={{
                // Note: Using smooth `opacity` transition to avoid the flickering issue when the `isPending` state
                //       changes very quickly (due to the network request being fast).
                transition: 'opacity 0.5s',
                opacity: isPending ? 0.5 : undefined
            }}
        >
            {Object.keys(crons).map(function (cron, index) {
                return (
                    <div
                        key={index}
                        style={{
                            display: 'flex'
                        }}
                    >
                        <Switch
                            checked={cronsOb[cron]}
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
    );
};
Crons.propTypes = {
    taskId: propTypes.string,
    crons: propTypes.object
};

export { Crons };
