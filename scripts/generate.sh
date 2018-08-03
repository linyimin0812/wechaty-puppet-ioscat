#!/usr/bin/env bash
set -e

docker run --rm -v \
  ${PWD}:/local \
  swaggerapi/swagger-codegen-cli:v2.3.1 \
    generate \
    -i /local/swagger/ioscat.yaml \
    -l typescript-node \
    -o /local/generated

sudo chown -R $(id -un) generated/

tsc \
  --target esnext \
  --module commonjs \
  --declaration \
  --declarationMap \
  generated/api.ts

rm -f generated/api.ts
