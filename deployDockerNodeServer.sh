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

docker kill $REPO

rm -rf $SERVERFOLDER
mv $TEMPFOLDER $SERVERFOLDER

docker start $REPO

echo "Déployé en" $((($(date +%s%N | cut -b1-13) - $startTime) / 1000)) "secondes"
