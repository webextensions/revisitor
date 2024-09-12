import React from 'react';

import InfoIcon from '@mui/icons-material/Info'; // eslint-disable-line node/file-extension-in-import

import { GenericAccordion } from '../../../base_modules/GenericAccordion/GenericAccordion.js';

import { Tasks } from './Components/Tasks/Tasks.js';

import * as styles from './Revisitor.css';

const Revisitor = function () {
    return (
        <div className={styles.Revisitor}>
            <GenericAccordion
                localStorageIdForExpanded="flagPanelTasks"
                title={<div style={{ lineHeight: '25px' }}>Tasks</div>}
                icon={<InfoIcon />}
                flagRefreshedAt
                el={({ refreshedAt }) => {
                    return <Tasks refreshedAt={refreshedAt} />;
                }}
            />
        </div>
    );
};

export { Revisitor };
