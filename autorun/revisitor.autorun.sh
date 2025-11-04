#!/bin/bash

cd "$(dirname "$0")" # Change directory to the folder containing this file
cd ..                # Change directory to the root folder of the project

set -x

pwd

set +x
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
set -x

sleep 5

set +x

# Attempt to use the existing Node.js version if already available
echo "$ nvm use"
        nvm use

# If nvm use failed, install the Node.js version
if [ $? -ne 0 ]; then
    echo "$ nvm install -b"
            nvm install -b

    # Though `nvm install` internally calls `nvm use` in general, but `nvm install` may fail if internet connection is not
    # available (and `nvm use` is not called in that case)
    echo "$ nvm use"
            nvm use
fi

set -x

npm install --prefer-offline

npx --prefer-offline --yes node-notifier-cli notify -t 'Revisitor - Git Access' -m 'You may be prompted to unlock the private key.'

sleep 5


# Note: The following command (`npm start`) is a long-running command, so either keep it as the last statement in this
#       script or run it in background

#     npm start
nohup npm start > app-data/logs/nohup.out 2>&1 &
