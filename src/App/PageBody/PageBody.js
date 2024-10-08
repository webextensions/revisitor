import React from 'react';

import * as styles from './PageBody.css';

// import { AfterDelay } from '@webextensions/react/components/AfterDelay/AfterDelay.js';

// import { Loading } from '../../ImportedComponents/Loading/Loading.js';

// import { ClickToShow } from '@webextensions/react/components/ClickToShow/ClickToShow.js';

import { Revisitor } from '../Components/Revisitor/Revisitor.js';

const PageBody = function () {
    return (
        <div className={styles.PageBody}>
            <div>
                <Revisitor />
            </div>

            {/* <div>
                <ClickToShow type="button">
                    <div style={{ margin: 20 }}>
                        Show this long message when clicked.
                    </div>
                </ClickToShow>
            </div> */}

            {/* <div>
                <AfterDelay delay={1000}>
                    <Loading
                        type="line-scale"
                        style={{ width: '100px', height: '100px' }}
                        theme="dark"
                    />
                </AfterDelay>
            </div>

            <div>
                <Loading
                    type="line-scale"
                    style={{ width: '100px', height: '100px' }}
                    theme="dark"
                />
            </div> */}
        </div>
    );
};

export { PageBody };
