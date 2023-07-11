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
WEBSITEFOLDER=~/websites/$1
IFS=':' && read -ra IGNOREDFILES <<<$4 && IFS=' '

git clone https://$3@github.com/$USER/$REPO -b $BRANCH $TEMPFOLDER

for IGNOREDFILE in "${IGNOREDFILES[@]}"; do
    if [ -e $WEBSITEFOLDER/$IGNOREDFILE ]; then
        rm -rf $TEMPFOLDER/$IGNOREDFILE
        cp -r $WEBSITEFOLDER/$IGNOREDFILE $TEMPFOLDER/$IGNOREDFILE
    fi
done

rm -rf $WEBSITEFOLDER
mv $TEMPFOLDER $WEBSITEFOLDER
