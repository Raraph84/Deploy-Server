#!/bin/bash -e

if [ "$#" -ne 4 ] && [ "$#" -ne 5 ]; then
    echo "Invalid number of parameters"
    exit 1
fi

SPLITTED_REPOSITORY=(${2//\// })
USER=${SPLITTED_REPOSITORY[0]}
REPO=${SPLITTED_REPOSITORY[1]}
BRANCH=${SPLITTED_REPOSITORY[2]}
TEMP_DIR=$(mktemp -d)
WEBSITE_DIR=~/servers/$1
DOCKER_IMAGE=$4
IFS=':' && read -ra IGNORED_FILES <<<$5 && IFS=' '

git clone https://$3@github.com/$USER/$REPO -b $BRANCH $TEMP_DIR
rm -rf $TEMP_DIR/.git

if [ -e $TEMP_DIR/package.json ]; then
    cd $TEMP_DIR
    if [ -e $WEBSITE_DIR/package.json ] && [ -e $WEBSITE_DIR/node_modules ]; then
        if [ -z "$(cmp $TEMP_DIR/package.json $WEBSITE_DIR/package.json)" ]; then
            cp -r $WEBSITE_DIR/node_modules $TEMP_DIR
        else
            docker run --rm -i -v $TEMP_DIR:/home/server $DOCKER_IMAGE npm install --omit=dev
        fi
    else
        docker run --rm -i -v $TEMP_DIR:/home/server $DOCKER_IMAGE npm install --omit=dev
    fi
fi

for IGNORED_FILE in "${IGNORED_FILES[@]}"; do
    if [ -e $WEBSITE_DIR/$IGNORED_FILE ]; then
        rm -rf $TEMP_DIR/$IGNORED_FILE
        cp -r $WEBSITE_DIR/$IGNORED_FILE $TEMP_DIR/$IGNORED_FILE
    fi
done

docker run --rm -i -v $TEMP_DIR:/home/server $DOCKER_IMAGE npm run build

rm -rf $WEBSITE_DIR
mv $TEMP_DIR $WEBSITE_DIR
