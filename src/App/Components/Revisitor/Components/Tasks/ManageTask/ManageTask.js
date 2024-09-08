import React from 'react';
import propTypes from 'prop-types';

import { Crons } from '../Crons/Crons.js';

// TODO: FIXME: If a network request is triggered by standard table-row view, then the detailed table-row view should
//              also remain in sync (in terms of UX controls to be disabled) and vice versa.

const ManageTask = ({ taskId, crons }) => {
    return (
        <div>
            <div style={{ paddingLeft: 10, paddingTop: 10 }}>
                <Crons
                    detailedView
                    taskId={taskId}
                    crons={crons}
                />
            </div>
        </div>
    );
};
ManageTask.propTypes = {
    taskId: propTypes.string.isRequired,
    crons: propTypes.object.isRequired
};

export { ManageTask };
