#!/bin/sh
set -eu

image_tag="wsr-ui-bi:wave2-smoke-$$"
container_name="wsr-ui-bi-smoke-$$"

cleanup() {
  docker container rm --force "$container_name" >/dev/null 2>&1 || true
  docker image rm --force "$image_tag" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --tag "$image_tag" .
docker run --detach --name "$container_name" \
  --env EVIDENCE_UPSTREAM=127.0.0.1:9 \
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

curl --fail --silent --show-error "http://127.0.0.1:${host_port}/preview" | grep -q '<div id="root"></div>'
