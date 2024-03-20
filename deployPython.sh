#!/bin/bash -e

if [ "$#" -ne 3 ] && [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    exit 1
fi

SPLITTED_REPOSITORY=(${2//\// })
USER=${SPLITTED_REPOSITORY[0]}
REPO=${SPLITTED_REPOSITORY[1]}
BRANCH=${SPLITTED_REPOSITORY[2]}
TEMP_FOLDER=$(mktemp -d)
SERVER_FOLDER=~/servers/$1
IFS=':' && read -ra IGNORED_FILES <<<$4 && IFS=' '

git clone https://$3@github.com/$USER/$REPO -b $BRANCH $TEMP_FOLDER
rm -rf $TEMP_FOLDER/.git

for IGNORED_FILE in "${IGNORED_FILES[@]}"; do
    if [ -e $SERVER_FOLDER/$IGNORED_FILE ]; then
        rm -rf $TEMP_FOLDER/$IGNORED_FILE
        cp -r $SERVER_FOLDER/$IGNORED_FILE $TEMP_FOLDER/$IGNORED_FILE
    fi
done

rm -rf $SERVER_FOLDER
mv $TEMP_FOLDER $SERVER_FOLDER
