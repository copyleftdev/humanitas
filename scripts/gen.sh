#!/usr/bin/env bash
# Regenerate the typed surface for every Humana API from the raw spec files.
#
# Humana publishes most Apigee specs as Swagger 2.0, which openapi-typescript v7
# rejects — so we convert 2.0 -> 3.0 with swagger2openapi first. The Plan Info
# spec is already OpenAPI 3.0 and passes through unchanged.
#
# Source of truth: specs/*.{json,yaml}  ->  specs/openapi3/*.json  ->  src/generated/*.ts
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/node_modules/.bin:$PATH"

mkdir -p specs/openapi3 src/generated

# name : source spec (relative to specs/)
swagger2=(
  "agent:agent.json"
  "smallGroup:smallGroup.json"
  "enrollment:enrollment.json"
  "enrollmentReporting:enrollmentReporting.json"
  "idvEnrollment:idvEnrollment.json"
  "drugList:drugList.yaml"
)

for pair in "${swagger2[@]}"; do
  name="${pair%%:*}"; file="specs/${pair##*:}"
  # swagger2openapi reads YAML or JSON; --patch fixes minor spec defects
  # (e.g. an empty info.termsOfService).
  npx --yes swagger2openapi --patch "$file" -o "specs/openapi3/$name.json" >/dev/null
done

# Plan Info is already OpenAPI 3.0.
cp specs/planInformation.json specs/openapi3/planInformation.json

for f in specs/openapi3/*.json; do
  name="$(basename "$f" .json)"
  openapi-typescript "$f" -o "src/generated/$name.ts" >/dev/null
  echo "✔ $name"
done

echo "✔ generated $(ls src/generated | wc -l) API type modules into src/generated"
