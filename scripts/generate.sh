#!/usr/bin/env bash
set -e

# Directory to write generated code to (.js and .d.ts files)
OUT_DIR="./generated"
[ -d ${OUT_DIR} ] || {
  mkdir ${OUT_DIR}
}

SWAGGER_JSON="$OUT_DIR/swagger.json"

yaml2json swagger/ioscat.yaml > "$SWAGGER_JSON"
swagger-ts-client-generator < "$SWAGGER_JSON" > generated/api.ts
