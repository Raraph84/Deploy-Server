#!/bin/bash -e

if [ "$#" -ne 3 ] && [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    exit 1
fi

SPLITTED_REPOSITORY=(${2//\// })
USER=${SPLITTED_REPOSITORY[0]}
REPO=${SPLITTED_REPOSITORY[1]}
BRANCH=${SPLITTED_REPOSITORY[2]}
TEMP_DIR=$(mktemp -d)
SERVER_DIR=~/servers/$1
IFS=':' && read -ra IGNORED_FILES <<<$4 && IFS=' '

git clone https://$3@github.com/$USER/$REPO -b $BRANCH $TEMP_DIR
rm -rf $TEMP_DIR/.git

for IGNORED_FILE in "${IGNORED_FILES[@]}"; do
    if [ -e $SERVER_DIR/$IGNORED_FILE ]; then
        rm -rf $TEMP_DIR/$IGNORED_FILE
        cp -r $SERVER_DIR/$IGNORED_FILE $TEMP_DIR/$IGNORED_FILE
    fi
done

rm -rf $SERVER_DIR
mv $TEMP_DIR $SERVER_DIR
