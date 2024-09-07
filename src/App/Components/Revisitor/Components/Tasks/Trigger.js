import React from 'react';
import propTypes from 'prop-types';

import { useMutation } from '@tanstack/react-query';

import Button from '@mui/material/Button/index.js';
import PlayArrowIcon from '@mui/icons-material/PlayArrow.js';

import { safeArrayPromiseToErrorPromise } from '../../../../utils/safeArrayPromiseToErrorPromise.js';
import { LoadingErrorLoaded } from '../../../../../base_modules/LoadingErrorLoaded/LoadingErrorLoaded.js';

import { triggerTask } from '../../../../dal.js';

const Trigger = ({ taskId }) => {
    const {
        mutate,
        status,
        isPending
    } = useMutation({
        mutationFn: () => {
            const p = triggerTask({
                taskId,
                waitForCompletion: true
            });
            const querifiedP = safeArrayPromiseToErrorPromise(p);
            return querifiedP;
        }
    });
    return (
        <div>
            <div>
                <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    size="small"
                    disabled={isPending}
                    onClick={async () => {
                        await mutate();
                    }}
                >
                    {isPending ? 'Running...' : 'Trigger'}
                </Button>
            </div>
            <div>
                <LoadingErrorLoaded
                    fn="useMutation"
                    status={status}
                    style={{
                        marginTop: 3,
                        marginBottom: 5,
                        display: 'flex',
                        justifyContent: 'center'
                    }}
                />
            </div>
        </div>
    );
};
Trigger.propTypes = {
    taskId: propTypes.string,
    waitForCompletion: propTypes.bool
};

export { Trigger };
