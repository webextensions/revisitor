import React from 'react';

import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query';

import './App.css';

import { PageHeader } from './PageHeader/PageHeader.js';
import { PageBody } from './PageBody/PageBody.js';
// import { TodoList } from './TodoList/TodoList.js';
// import { Dashboard } from './Dashboard/Dashboard.js';
import { PageFooter } from './PageFooter/PageFooter.js';
import { PageWidgets } from './PageWidgets/PageWidgets.js';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,

            // eg:
            //     * Go offline and come back online
            //     * Locking and unlocking the mobile phone, while the webpage is open
            refetchOnReconnect: false,

            // https://github.com/TanStack/query/issues/2927#issuecomment-974706069
            // https://github.com/TanStack/query/issues/2179
            networkMode: 'always',

            retry: function (failureCount, error) {
                const errorResponseStatus = error?.response?.status;

                if (
                    failureCount < 3 &&
                    [502, 503, 504].includes(errorResponseStatus)
                ) {
                    return true;
                } else {
                    return false;
                }
            }
        }
    }
});

const App = function () {
    return (
        <QueryClientProvider client={queryClient}>
            <div>
                <PageHeader />
                <PageBody />
                {/* <TodoList /> */}
                {/* <div>
                    <Dashboard />
                </div> */}
                {/* <br /> */}
                <PageFooter />
                <PageWidgets />
            </div>
        </QueryClientProvider>
    );
};

export { App };
