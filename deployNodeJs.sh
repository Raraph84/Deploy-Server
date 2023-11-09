#!/bin/bash

if [ "$#" -ne 3 ] && [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    exit
fi

SPLITTED_REPOSITORY=(${2//\// })
USER=${SPLITTED_REPOSITORY[0]}
REPO=${SPLITTED_REPOSITORY[1]}
BRANCH=${SPLITTED_REPOSITORY[2]}
TEMPFOLDER=$(mktemp -d)
SERVERFOLDER=~/servers/$1
IFS=':' && read -ra IGNOREDFILES <<<$4 && IFS=' '

git clone https://$3@github.com/$USER/$REPO -b $BRANCH $TEMPFOLDER

if [ -e $TEMPFOLDER/package.json ]; then
    cd $TEMPFOLDER
    if [ -e $SERVERFOLDER/package.json ] && [ -e $SERVERFOLDER/node_modules ]; then
        if [ -z "$(cmp $TEMPFOLDER/package.json $SERVERFOLDER/package.json)" ]; then
            cp -r $SERVERFOLDER/node_modules $TEMPFOLDER
        else
            npm install --omit=dev
        fi
    else
        npm install --omit=dev
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
