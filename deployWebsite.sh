#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Invalid number of parameters"
    exit
fi

GITHUB=https://$3@github.com/$2
TEMPFOLDER=~/deployServer/temp/$1
WEBSITEFOLDER=~/websites/${2#*/}

git clone $GITHUB $TEMPFOLDER
chmod -R g+w $TEMPFOLDER

rm -rf $WEBSITEFOLDER
mv $TEMPFOLDER $WEBSITEFOLDER
