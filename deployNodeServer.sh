#!/bin/bash

startTime=$(date +%s%N | cut -b1-13)

if [ "$#" -ne 2 ]; then
    echo "Invalid number of parameters"
    exit
fi

SPLIT_REPOSITORY=(${1//\// })
USER=${SPLIT_REPOSITORY[0]}
REPO=${SPLIT_REPOSITORY[1]}
GITHUB=https://$2@github.com/$USER/$REPO

TEMPFOLDER=~/deployServer/temp/$REPO
SERVERFOLDER=~/nodeServers/$REPO

git clone $GITHUB $TEMPFOLDER

if [ -e $TEMPFOLDER/package.json ]; then
    cd $TEMPFOLDER
    if [ -e $SERVERFOLDER/package.json ] && [ -e $SERVERFOLDER/node_modules ]; then
        if [ -z "$(cmp $TEMPFOLDER/package.json $SERVERFOLDER/package.json)" ]; then
            cp -r $SERVERFOLDER/node_modules $TEMPFOLDER
        else
            npm install --production
        fi
    else
        npm install --production
    fi
fi

screen -X -S $REPO kill

rm -rf $SERVERFOLDER
mv $TEMPFOLDER $SERVERFOLDER

screen -dmS $REPO sh -c "bash -c \"while true; do echo \\\"[$(date +"%d/%m/%Y %H:%M")] Démarrage du serveur...\\\"; node index.js; sleep 3; done\" 2>&1 | tee ~/deployServer/logs/$REPO"

echo "Déployé en" $((($(date +%s%N | cut -b1-13) - $startTime) / 1000)) "secondes"
