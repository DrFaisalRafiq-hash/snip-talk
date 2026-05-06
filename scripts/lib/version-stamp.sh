#!/usr/bin/env bash
# Shared version-stamping helper for all platform packagers.
#
# Source this from any release script:
#
#   APP_NAME="Snip Talk"
#   ARCH="arm64"               # arm64 | x64 | universal | win32 | linux | ...
#   PLATFORM="darwin"          # darwin | win32 | linux
#   . scripts/lib/version-stamp.sh
#
# After sourcing, these variables are exported for downstream tools:
#   APP_VERSION         -> semver from package.json (e.g. 0.1.0)
#   BUILD_NUMBER        -> CI run #, else git commit count, else timestamp
#   GIT_SHA             -> short hash, or "nogit"
#   GIT_DIRTY           -> "" or "-dirty"
#   GIT_DIRTY_BOOL      -> "true" or "false" (for JSON)
#   VERSION_STAMP       -> "<version>+<build>.<sha>[-dirty]"
#   ARTIFACT_BASE       -> "<APP-NAME>-<stamp>-<platform>-<arch>"
#   BUILD_INFO_JSON     -> path to a freshly written build-info.json
#   BUILD_INFO_PATH     -> same (alias)
#
# It also prints a single-line "▸ version stamp: ..." header for build logs.

set -euo pipefail

APP_NAME="${APP_NAME:?APP_NAME must be set before sourcing version-stamp.sh}"
PLATFORM="${PLATFORM:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
ARCH="${ARCH:-$(uname -m)}"

APP_VERSION="$(node -p "require('./package.json').version")"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_SHA="$(git rev-parse --short=8 HEAD)"
  GIT_DIRTY=""
  GIT_DIRTY_BOOL="false"
  if ! git diff --quiet HEAD -- 2>/dev/null; then
    GIT_DIRTY="-dirty"
    GIT_DIRTY_BOOL="true"
  fi
  DEFAULT_BUILD="$(git rev-list --count HEAD)"
else
  GIT_SHA="nogit"
  GIT_DIRTY=""
  GIT_DIRTY_BOOL="false"
  DEFAULT_BUILD="$(date -u +%Y%m%d%H%M)"
fi

BUILD_NUMBER="${BUILD_NUMBER:-$DEFAULT_BUILD}"
VERSION_STAMP="${APP_VERSION}+${BUILD_NUMBER}.${GIT_SHA}${GIT_DIRTY}"
ARTIFACT_BASE="${APP_NAME// /-}-${VERSION_STAMP}-${PLATFORM}-${ARCH}"

mkdir -p build
BUILD_INFO_JSON="build/build-info.json"
BUILD_INFO_PATH="$BUILD_INFO_JSON"
cat > "$BUILD_INFO_JSON" <<JSON
{
  "name": "$APP_NAME",
  "version": "$APP_VERSION",
  "build": "$BUILD_NUMBER",
  "commit": "$GIT_SHA",
  "dirty": $GIT_DIRTY_BOOL,
  "stamp": "$VERSION_STAMP",
  "arch": "$ARCH",
  "platform": "$PLATFORM",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

export APP_VERSION BUILD_NUMBER GIT_SHA GIT_DIRTY GIT_DIRTY_BOOL
export VERSION_STAMP ARTIFACT_BASE BUILD_INFO_JSON BUILD_INFO_PATH
export VITE_APP_VERSION="$APP_VERSION"
export VITE_APP_BUILD="$BUILD_NUMBER"
export VITE_APP_COMMIT="$GIT_SHA"
export VITE_APP_VERSION_STAMP="$VERSION_STAMP"

echo "▸ version stamp: $VERSION_STAMP  (${PLATFORM}/${ARCH})"
