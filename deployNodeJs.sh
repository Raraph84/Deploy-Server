#!/bin/bash

if [ "$#" -ne 3 ] && [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    exit
fi

GITHUB=https://$3@github.com/$2
TEMPFOLDER=~/deployServer/temp/$1
SERVERFOLDER=~/nodeServers/$1
IFS=':' && read -ra IGNOREDFILES <<< $4 && IFS=' '

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

for IGNOREDFILE in "${IGNOREDFILES[@]}"; do
    if [ -e $SERVERFOLDER/$IGNOREDFILE ]; then
        rm -rf $TEMPFOLDER/$IGNOREDFILE
        cp -r $SERVERFOLDER/$IGNOREDFILE $TEMPFOLDER/$IGNOREDFILE
    fi
done

rm -rf $SERVERFOLDER
mv $TEMPFOLDER $SERVERFOLDER
