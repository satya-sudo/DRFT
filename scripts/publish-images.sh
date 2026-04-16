#!/usr/bin/env sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

DOCKER_NAMESPACE="${DOCKER_NAMESPACE:-dockermaninthehouse}"
API_REPO="${API_REPO:-$DOCKER_NAMESPACE/drft-api}"
WEB_REPO="${WEB_REPO:-$DOCKER_NAMESPACE/drft-web}"
TAG="${1:-${DRFT_IMAGE_TAG:-latest}}"
PUSH_LATEST="${PUSH_LATEST:-true}"

echo "Publishing DRFT images"
echo "  API repo: $API_REPO"
echo "  Web repo: $WEB_REPO"
echo "  Tag: $TAG"

docker build \
  -f "$ROOT_DIR/backend/Dockerfile" \
  -t "$API_REPO:$TAG" \
  "$ROOT_DIR/backend"

docker build \
  -f "$ROOT_DIR/frontend/Dockerfile.web" \
  -t "$WEB_REPO:$TAG" \
  "$ROOT_DIR/frontend"

docker push "$API_REPO:$TAG"
docker push "$WEB_REPO:$TAG"

if [ "$PUSH_LATEST" = "true" ] && [ "$TAG" != "latest" ]; then
  docker tag "$API_REPO:$TAG" "$API_REPO:latest"
  docker tag "$WEB_REPO:$TAG" "$WEB_REPO:latest"
  docker push "$API_REPO:latest"
  docker push "$WEB_REPO:latest"
fi

echo "Published:"
echo "  $API_REPO:$TAG"
echo "  $WEB_REPO:$TAG"
