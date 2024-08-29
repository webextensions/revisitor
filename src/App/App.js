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

const queryClient = new QueryClient();

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
            </div>
        </QueryClientProvider>
    );
};

export { App };
