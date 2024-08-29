import React from 'react';

import InfoIcon from '@mui/icons-material/Info.js';

import { GenericAccordion } from '../../../base_modules/GenericAccordion/GenericAccordion.js';

import { AddConfig } from './Components/AddConfig/AddConfig.js';
import { TasksInfo } from './Components/TasksInfo/TasksInfo.js';

import * as styles from './Revisitor.css';

const Revisitor = function () {
    return (
        <div className={styles.Revisitor}>
            <AddConfig />

            <GenericAccordion
                localStorageIdForExpanded="flagPanelTasksInfo"
                title="Tasks Info"
                icon={<InfoIcon />}
                flagRefreshedAt
                el={({ refreshedAt }) => {
                    return <TasksInfo refreshedAt={refreshedAt} />;
                }}
            />
        </div>
    );
};

export { Revisitor };
