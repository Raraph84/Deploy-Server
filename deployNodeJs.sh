#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Invalid number of parameters"
    exit
fi

GITHUB=https://$3@github.com/$2
TEMPFOLDER=~/deployServer/temp/$1
SERVERFOLDER=~/nodeServers/$1

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

rm -rf $SERVERFOLDER
mv $TEMPFOLDER $SERVERFOLDER
