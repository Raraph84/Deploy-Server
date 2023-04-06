#!/bin/bash

if [ "$#" -ne 3 ] && [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    exit
fi

GITHUB=https://$3@github.com/$2
TEMPFOLDER=$(mktemp -d)
SERVERFOLDER=~/pythonServers/$1
IFS=':' && read -ra IGNOREDFILES <<<$4 && IFS=' '

git clone $GITHUB $TEMPFOLDER

for IGNOREDFILE in "${IGNOREDFILES[@]}"; do
    if [ -e $SERVERFOLDER/$IGNOREDFILE ]; then
        rm -rf $TEMPFOLDER/$IGNOREDFILE
        cp -r $SERVERFOLDER/$IGNOREDFILE $TEMPFOLDER/$IGNOREDFILE
    fi
done

rm -rf $SERVERFOLDER
mv $TEMPFOLDER $SERVERFOLDER
