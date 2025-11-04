import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Just a code block
{
    const pathEnvLocal = path.resolve(__dirname, '..', '.env');
    const pathEnvRunner = path.resolve(__dirname, '..', '.env.fallback.env');

    let pathEnv;
    let result;

    pathEnv = pathEnvLocal;
    result = dotenv.config({
        path: pathEnv
    });

    if (result.error) {
        pathEnv = pathEnvRunner;
        result = dotenv.config({
            path: pathEnv
        });
    }

    if (result.error) {
        console.error('Failed to load environment variables from:', pathEnv);
        process.exit(1); // eslint-disable-line unicorn/no-process-exit
    } else {
        console.log('Loaded environment variables from:', pathEnv);
    }
}
