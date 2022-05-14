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
WEBSITEFOLDER=~/websites/$REPO

git clone $GITHUB $TEMPFOLDER
chmod -R g+w $TEMPFOLDER

rm -rf $WEBSITEFOLDER
mv $TEMPFOLDER $WEBSITEFOLDER

echo "Déployé en" $((($(date +%s%N | cut -b1-13) - $startTime) / 1000)) "secondes"
