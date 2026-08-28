#!/bin/sh
set -eu

image_tag="wsr-ui-bi:wave9-smoke-$$"
container_name="wsr-ui-bi-smoke-$$"
evidence_name="wsr-ui-evidence-stub-$$"
evolution_name="wsr-ui-evolution-stub-$$"
network_name="wsr-ui-wave9-smoke-$$"

cleanup() {
  rm -f "/tmp/wsr-ui-smoke-response-$$"
  docker container rm --force "$container_name" >/dev/null 2>&1 || true
  docker container rm --force "$evidence_name" >/dev/null 2>&1 || true
  docker container rm --force "$evolution_name" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
  docker image rm --force "$image_tag" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --tag "$image_tag" .
docker network create "$network_name" >/dev/null
docker run --detach --name "$evidence_name" --network "$network_name" \
  --volume "$PWD/scripts/upstream-stub.mjs:/stub.mjs:ro" \
  node:24.12.0-alpine3.23 node /stub.mjs evidence >/dev/null
docker run --detach --name "$evolution_name" --network "$network_name" \
  --volume "$PWD/scripts/upstream-stub.mjs:/stub.mjs:ro" \
  node:24.12.0-alpine3.23 node /stub.mjs evolution >/dev/null
docker run --detach --name "$container_name" \
  --network "$network_name" \
  --env EVIDENCE_UPSTREAM="${evidence_name}:8080" \
  --env EVOLUTION_UPSTREAM="${evolution_name}:8080" \
  --publish 127.0.0.1::80 \
  "$image_tag" >/dev/null

host_port="$(docker port "$container_name" 80/tcp | sed -n 's/.*://p' | head -n 1)"
test -n "$host_port"

attempt=0
until curl --fail --silent --show-error "http://127.0.0.1:${host_port}/healthz" | grep -qx ok; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30
  sleep 0.5
done

base_url="http://127.0.0.1:${host_port}"
curl --fail --silent --show-error "${base_url}/evaluate" | grep -q '<div id="root"></div>'

curl --fail --silent --show-error "${base_url}/v1/evidence/tasks?limit=7" |
  grep -q '"identity":"evidence","method":"GET","url":"/v1/evidence/tasks?limit=7"'
curl --fail --silent --show-error "${base_url}/v1/evidence/facts?delivery_id=d" |
  grep -q '"identity":"evidence","method":"GET","url":"/v1/evidence/facts?delivery_id=d"'
curl --fail --silent --show-error "${base_url}/v1/evidence/traces?delivery_id=d" |
  grep -q '"identity":"evidence","method":"GET","url":"/v1/evidence/traces?delivery_id=d"'
curl --fail --silent --show-error \
  --header 'content-type: application/json' \
  --data '{"api_version":1}' \
  "${base_url}/api/evolution/v1/evaluations:compute?probe=1" |
  grep -q '"identity":"evolution","method":"POST","url":"/api/evolution/v1/evaluations:compute?probe=1","body":"{\\"api_version\\":1}"'

for route in \
  /api \
  /v1/evidence \
  /v1/evidence/manifests/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  /v1/evidence/unknown \
  /api/evolution/v1/unknown; do
  status="$(curl --silent --output /tmp/wsr-ui-smoke-response-$$ --write-out '%{http_code}' "${base_url}${route}")"
  test "$status" = 404
  ! grep -q '<div id="root"></div>' /tmp/wsr-ui-smoke-response-$$
done

for route in /v1/evidence/tasks /v1/evidence/facts /v1/evidence/traces; do
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' --request POST "${base_url}${route}")"
  test "$status" = 405
done
status="$(curl --silent --output /dev/null --write-out '%{http_code}' "${base_url}/api/evolution/v1/evaluations:compute")"
test "$status" = 405
