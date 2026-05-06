#!/usr/bin/env bash
# Write a per-release manifest JSON listing the produced artifacts, with
# SHA-256 checksums for verification, and emit a sibling SHASUMS file.
#
# Usage:
#   . scripts/lib/version-stamp.sh
#   . scripts/lib/release-manifest.sh
#   write_release_manifest "$OUT_DIR/${ARTIFACT_BASE}.json" \
#     "zip=$ZIP_PATH" "dmg=$DMG_PATH"
#
# Side effects:
#   • writes <manifest>            (JSON, includes per-artifact sha256)
#   • writes <manifest>.sha256     (sha256 of the manifest itself)
#   • writes <base>.SHASUMS        (one "<sha256>  <basename>" line per artifact)
#
# Requires version-stamp.sh to have been sourced first.

# Cross-platform sha256: prefer shasum (macOS), fallback to sha256sum (Linux).
_sha256() {
  local f="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | awk '{print $1}'
  else
    echo "error: no shasum/sha256sum available" >&2
    return 1
  fi
}

write_release_manifest() {
  local manifest="$1"; shift
  : "${VERSION_STAMP:?source scripts/lib/version-stamp.sh first}"

  local entries=""
  local shasums=""
  local first=1
  for pair in "$@"; do
    local key="${pair%%=*}"
    local path="${pair#*=}"
    [[ -z "$key" || -z "$path" ]] && continue
    if [[ ! -f "$path" ]]; then
      echo "warning: artifact missing for key '$key': $path" >&2
      continue
    fi
    local base size sha
    base="$(basename "$path")"
    size="$(wc -c < "$path" | tr -d ' ')"
    sha="$(_sha256 "$path")"
    [[ $first -eq 1 ]] || entries+=","
    entries+=$'\n    "'"$key"'": { "file": "'"$base"'", "size": '"$size"', "sha256": "'"$sha"'" }'
    shasums+="${sha}  ${base}"$'\n'
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
  "notarization": {
    "status": "${NOTARIZE_STATUS:-skipped}",
    "zip_submission_id": "${NOTARIZE_ZIP_ID:-}",
    "dmg_submission_id": "${NOTARIZE_DMG_ID:-}"
  },
  "artifacts": {${entries}
  }
}
JSON

  # Sibling SHASUMS file (compatible with `shasum -c` / `sha256sum -c`)
  local shasum_file="${manifest%.json}.SHASUMS"
  printf '%s' "$shasums" > "$shasum_file"

  # Hash of the manifest itself, so a release page can publish a single
  # short string for users to verify the manifest before trusting its hashes.
  local manifest_sha
  manifest_sha="$(_sha256 "$manifest")"
  echo "${manifest_sha}  $(basename "$manifest")" > "${manifest}.sha256"

  echo "   $manifest"
  echo "   $shasum_file"
  echo "   ${manifest}.sha256"
  echo "   manifest sha256: $manifest_sha"
}

# Detach-sign a file with `codesign --detached`, producing "<file>.sig".
# No-op (returns 0) when APPLE_IDENTITY is not set.
sign_artifact_detached() {
  local file="$1"
  [[ -z "${APPLE_IDENTITY:-}" ]] && return 0
  [[ ! -f "$file" ]] && return 0
  echo "▸ detach-signing $(basename "$file")"
  codesign --force --timestamp \
    --sign "$APPLE_IDENTITY" \
    --detached "${file}.sig" "$file"
}
