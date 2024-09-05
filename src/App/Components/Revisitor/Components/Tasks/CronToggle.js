import React, { useState } from 'react';
import propTypes from 'prop-types';

import Switch from '@mui/material/Switch/index.js';
import { useMutation } from '@tanstack/react-query';

import { toast } from '../../../../../ImportedComponents/react-toastify.js';

import { patchTask } from '../../../../dal.js';
import { safeArrayPromiseToErrorPromise } from '../../../../utils/safeArrayPromiseToErrorPromise.js';

const CronToggle = ({ taskId, hasCrons }) => {
    const [checked, setChecked] = useState(hasCrons);

    const {
        mutate,
        isPending
    } = useMutation({
        mutationFn: (newCheckedValue) => {
            const p = patchTask({
                taskId,
                hasCrons: newCheckedValue
            });
            const querifiedP = safeArrayPromiseToErrorPromise(p);
            return querifiedP;
        },
        // eslint-disable-next-line no-unused-vars
        onSuccess: function (data, newCheckedValue, context) {
            setChecked(newCheckedValue);
        },
        // eslint-disable-next-line no-unused-vars
        onError: function (error, variables, context) {
            toast.error('Error - Failed to toggle cron');
        }
    });

    return (
        <Switch
            checked={checked}
            disabled={isPending}
            style={{
                opacity: isPending ? 0.5 : undefined
            }}
            onChange={function (e) {
                mutate(e.target.checked);
            }}
        />
    );
};
CronToggle.propTypes = {
    taskId: propTypes.string,
    hasCrons: propTypes.bool
};

export { CronToggle };
