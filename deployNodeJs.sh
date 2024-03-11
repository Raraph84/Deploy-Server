#!/bin/bash -e

if [ "$#" -ne 4 ] && [ "$#" -ne 5 ]; then
    echo "Invalid number of parameters"
    exit 1
fi

SPLITTED_REPOSITORY=(${2//\// })
USER=${SPLITTED_REPOSITORY[0]}
REPO=${SPLITTED_REPOSITORY[1]}
BRANCH=${SPLITTED_REPOSITORY[2]}
TEMPFOLDER=$(mktemp -d)
SERVERFOLDER=~/servers/$1
DOCKER_IMAGE=$4
IFS=':' && read -ra IGNOREDFILES <<<$5 && IFS=' '

git clone https://$3@github.com/$USER/$REPO -b $BRANCH $TEMPFOLDER
rm -rf $TEMPFOLDER/.git

if [ -e $TEMPFOLDER/package.json ]; then
    cd $TEMPFOLDER
    if [ -e $SERVERFOLDER/package.json ] && [ -e $SERVERFOLDER/node_modules ]; then
        if [ -z "$(cmp $TEMPFOLDER/package.json $SERVERFOLDER/package.json)" ]; then
            cp -r $SERVERFOLDER/node_modules $TEMPFOLDER
        else
            docker run --rm -i -v $TEMPFOLDER:/home/server $DOCKER_IMAGE npm install --omit=dev
        fi
    else
        docker run --rm -i -v $TEMPFOLDER:/home/server $DOCKER_IMAGE npm install --omit=dev
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
