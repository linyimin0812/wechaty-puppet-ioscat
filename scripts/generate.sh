#!/usr/bin/env bash
set -e

docker run --rm -v ${PWD}:/local swaggerapi/swagger-codegen-cli generate \
    -i /local/swagger/ioscat.yaml \
    -l typescript-node \
    -o /local/generated
