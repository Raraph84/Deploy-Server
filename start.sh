#!/bin/bash -e

cd ~/deployServer

while true; do
    echo "[$(date +"%d/%m/%Y %H:%M:%S")] Starting..." | tee -a logs.txt
    node index.js 2>&1 | tee -a logs.txt
    sleep 3
done
