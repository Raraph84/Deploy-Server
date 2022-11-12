#!/bin/bash

if [ "$#" -ne 3 ] && [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    exit
fi

GITHUB=https://$3@github.com/$2
TEMPFOLDER=$(mktemp -d)
WEBSITEFOLDER=~/websites/$1
IFS=':' && read -ra IGNOREDFILES <<< $4 && IFS=' '

rm -rf $TEMPFOLDER
git clone $GITHUB $TEMPFOLDER
chmod -R ug+rwx $TEMPFOLDER

for IGNOREDFILE in "${IGNOREDFILES[@]}"; do
    if [ -e $WEBSITEFOLDER/$IGNOREDFILE ]; then
        rm -rf $TEMPFOLDER/$IGNOREDFILE
        cp -r $WEBSITEFOLDER/$IGNOREDFILE $TEMPFOLDER/$IGNOREDFILE
    fi
done

rm -rf $WEBSITEFOLDER
mv $TEMPFOLDER $WEBSITEFOLDER
