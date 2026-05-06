#!/usr/bin/env bash
# Write a per-release manifest JSON listing the produced artifacts.
#
# Usage:
#   . scripts/lib/version-stamp.sh
#   write_release_manifest "$OUT_DIR/${ARTIFACT_BASE}.json" \
#     "zip=$ZIP_PATH" "dmg=$DMG_PATH" "msi=$MSI_PATH"
#
# Each "key=path" pair becomes an entry under "artifacts" using basename($path).
# Requires version-stamp.sh to have been sourced first.

write_release_manifest() {
  local manifest="$1"; shift
  : "${VERSION_STAMP:?source scripts/lib/version-stamp.sh first}"

  local entries=""
  local first=1
  for pair in "$@"; do
    local key="${pair%%=*}"
    local path="${pair#*=}"
    [[ -z "$key" || -z "$path" ]] && continue
    [[ $first -eq 1 ]] || entries+=","
    entries+=$'\n    "'"$key"'": "'"$(basename "$path")"'"'
    first=0
  done

  cat > "$manifest" <<JSON
{
  "name": "$APP_NAME",
  "version": "$APP_VERSION",
  "build": "$BUILD_NUMBER",
  "commit": "$GIT_SHA",
  "dirty": $GIT_DIRTY_BOOL,
  "arch": "$ARCH",
  "platform": "$PLATFORM",
  "stamp": "$VERSION_STAMP",
  "artifacts": {${entries}
  }
}
JSON
  echo "   $manifest"
}
