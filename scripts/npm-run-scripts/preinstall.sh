#!/bin/bash

cd "$(dirname "$0")"    # Change directory to the folder containing this file

../health-checks/check-node-version.ts --return-exit-code
