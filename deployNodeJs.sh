#!/bin/bash -e

if [ "$#" -ne 4 ] && [ "$#" -ne 5 ]; then
    echo "Invalid number of parameters"
    exit 1
fi

SPLITTED_REPOSITORY=(${2//\// })
USER=${SPLITTED_REPOSITORY[0]}
REPO=${SPLITTED_REPOSITORY[1]}
BRANCH=${SPLITTED_REPOSITORY[2]}
TEMP_FOLDER=$(mktemp -d)
SERVER_FOLDER=~/servers/$1
DOCKER_IMAGE=$4
IFS=':' && read -ra IGNORED_FILES <<<$5 && IFS=' '

git clone https://$3@github.com/$USER/$REPO -b $BRANCH $TEMP_FOLDER
rm -rf $TEMP_FOLDER/.git

if [ -e $TEMP_FOLDER/package.json ]; then
    cd $TEMP_FOLDER
    if [ -e $SERVER_FOLDER/package.json ] && [ -e $SERVER_FOLDER/node_modules ]; then
        if [ -z "$(cmp $TEMP_FOLDER/package.json $SERVER_FOLDER/package.json)" ]; then
            cp -r $SERVER_FOLDER/node_modules $TEMP_FOLDER
        else
            docker run --rm -i -v $TEMP_FOLDER:/home/server $DOCKER_IMAGE npm install --omit=dev
        fi
    else
        docker run --rm -i -v $TEMP_FOLDER:/home/server $DOCKER_IMAGE npm install --omit=dev
    fi
fi

for IGNORED_FILE in "${IGNORED_FILES[@]}"; do
    if [ -e $SERVER_FOLDER/$IGNORED_FILE ]; then
        rm -rf $TEMP_FOLDER/$IGNORED_FILE
        cp -r $SERVER_FOLDER/$IGNORED_FILE $TEMP_FOLDER/$IGNORED_FILE
    fi
done

rm -rf $SERVER_FOLDER
mv $TEMP_FOLDER $SERVER_FOLDER
