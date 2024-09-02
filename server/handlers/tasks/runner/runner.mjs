import { $, execa } from 'execa';

const runner = async (taskConfig) => {
    console.log('Task Config:', taskConfig);
    console.log('execa:', execa);
    console.log('execa $:', $);
};

export { runner };
