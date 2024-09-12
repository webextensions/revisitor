import React from 'react';
import propTypes from 'prop-types';

import { useMutation } from '@tanstack/react-query';

import Button from '@mui/material/Button/index.js';
import DeleteIcon from '@mui/icons-material/Delete'; // eslint-disable-line node/file-extension-in-import

import { safeArrayPromiseToErrorPromise } from '../../../../../utils/safeArrayPromiseToErrorPromise.js';

import { deleteTask } from '../../../../../dal.js';

const DeleteTask = ({ taskId, onDelete }) => {
    const {
        mutate,
        status,
        isPending
    } = useMutation({
        mutationFn: () => {
            const p = deleteTask({ taskId });
            const querifiedP = safeArrayPromiseToErrorPromise(p);
            return querifiedP;
        }
    });

    if (status === 'success') {
        return <div>Deleted</div>;
    }

    return (
        <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            size="small"
            disabled={isPending}
            onClick={async () => {
                // eslint-disable-next-line no-alert
                const confirmed = window.confirm('Are you sure you want to delete this task?');
                if (confirmed) {
                    await mutate();
                    onDelete();
                }
            }}
        >
            {isPending ? 'Deleting...' : 'Delete'}
        </Button>
    );
};
DeleteTask.propTypes = {
    taskId: propTypes.string,
    onDelete: propTypes.func
};

export { DeleteTask };
