#!/usr/bin/env bash
rsync -hvrP lib/* /ml/storage/data/bazhou/ml/learning_daemon/lib
pushd /ml/storage/data/bazhou/
az_upload ml/learning_daemon/lib
popd
docker build ./ -t bartuer/learning_daemon