import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Loading } from '../../ImportedComponents/Loading/Loading.js';

const LoadingErrorLoaded = function ({
    fn, // Allowed values: 'useQuery', 'useMutation'

    status,
    fetchStatus,

    showRawData,
    data,

    style
}) {
    const [lastLoadingTriggerObserved, setLastLoadingTriggerObserved] = useState(null);
    const [lastSuccessOrErrorObserved, setLastSuccessOrErrorObserved] = useState(null);

    useEffect(() => {
        if (
            (fn === 'useMutation' && status === 'pending') ||
            (fn === 'useQuery' && fetchStatus === 'fetching')
        ) {
            setLastLoadingTriggerObserved(Date.now());
        } else if (status === 'success' || status === 'error') {
            setLastSuccessOrErrorObserved(Date.now());
        }
    }, [fetchStatus, status]);

    if (
        (fn === 'useMutation' && status === 'pending') ||
        (fn === 'useQuery' && fetchStatus === 'fetching')
    ) {
        return (
            <div
                style={style}
                title={`Since ${new Date(lastLoadingTriggerObserved).toLocaleString()}`}
            >
                <Loading type="line-scale" />
            </div>
        );
    } else if (status === 'error') {
        return (
            <div style={style}>
                <div
                    style={{ color: 'red' }}
                    title={(() => {
                        const lastLoadingTriggerObservedDate = new Date(lastLoadingTriggerObserved);
                        const lastSuccessOrErrorObservedDate = new Date(lastSuccessOrErrorObserved);

                        const timeTaken = lastSuccessOrErrorObserved - lastLoadingTriggerObserved;

                        return `${timeTaken}ms\nFrom: ${lastLoadingTriggerObservedDate.toLocaleString()}\nTo: ${lastSuccessOrErrorObservedDate.toLocaleString()}`;
                    })()}
                >
                    ✘ Error
                </div>
                {
                    showRawData &&
                    data &&
                    <div style={{ marginTop: 5, whiteSpace: 'pre', fontFamily: 'monospace' }}>
                        {JSON.stringify(data, null, '    ')}
                    </div>
                }
            </div>
        );
    } else if (status === 'success') {
        return (
            <div style={style}>
                <div
                    style={{ color: 'darkgreen' }}
                    title={(() => {
                        const lastLoadingTriggerObservedDate = new Date(lastLoadingTriggerObserved);
                        const lastSuccessOrErrorObservedDate = new Date(lastSuccessOrErrorObserved);

                        const timeTaken = lastSuccessOrErrorObserved - lastLoadingTriggerObserved;

                        return `${timeTaken}ms\nFrom: ${lastLoadingTriggerObservedDate.toLocaleString()}\nTo: ${lastSuccessOrErrorObservedDate.toLocaleString()}`;
                    })()}
                >
                    ✔ Success
                </div>
                {
                    showRawData &&
                    data &&
                    <div style={{ marginTop: 5, whiteSpace: 'pre', fontFamily: 'monospace', overflow: 'auto' }}>
                        {JSON.stringify(data, null, '    ')}
                    </div>
                }
            </div>
        );
    } else {
        return null;
    }
};
LoadingErrorLoaded.propTypes = {
    fn: PropTypes.string.isRequired,

    status: PropTypes.string.isRequired,
    fetchStatus: PropTypes.string,

    showRawData: PropTypes.bool,
    data: PropTypes.object,

    style: PropTypes.object
};

export { LoadingErrorLoaded };
