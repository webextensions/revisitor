import React from 'react';
import propTypes from 'prop-types';

import { useMutation } from '@tanstack/react-query';

import { errAndDataArrayToPromise } from '../../../../utils/errAndDataArrayToPromise.js';

import { triggerTask } from '../../../../dal.js';

const Trigger = ({ taskId }) => {
    const {
        mutate,
        status,
        isPending
    } = useMutation({
        mutationFn: () => {
            const p = errAndDataArrayToPromise(triggerTask, [{
                taskId,
                waitForCompletion: true
            }]);
            return p;
        }
    });
    return (
        <div>
            <div>
                <button
                    disabled={isPending}
                    onClick={async () => {
                        await mutate();
                    }}
                >
                    {isPending ? 'Running...' : 'Trigger'}
                </button>
            </div>
            <div>
                {status === 'success' && 'Completed'}
                {status === 'error' && 'Error'}
            </div>
        </div>
    );
};
Trigger.propTypes = {
    taskId: propTypes.string,
    waitForCompletion: propTypes.bool
};

export { Trigger };
