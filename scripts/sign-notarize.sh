#!/usr/bin/env bash
# Sign, notarize, and staple an existing macOS .app bundle.
# Use this when you already have a built .app (from `electron-packager` or
# `npm run electron:package:mac`) and just need to sign/notarize it.
#
#   ./scripts/sign-notarize.sh "release/Snip Talk-darwin-arm64/Snip Talk.app"
#
# Required env vars:
#   APPLE_IDENTITY                "Developer ID Application: Your Name (TEAMID)"
#   APPLE_ID                      you@example.com
#   APPLE_TEAM_ID                 TEAMID
#   APPLE_APP_SPECIFIC_PASSWORD   xxxx-xxxx-xxxx-xxxx (app-specific password)
#
# Optional:
#   ENTITLEMENTS                  path to entitlements (default: build/entitlements.mac.plist)
#   SKIP_NOTARIZE=1               sign + verify only (no notarytool/staple)
set -euo pipefail

APP_PATH="${1:-}"
ENTITLEMENTS="${ENTITLEMENTS:-build/entitlements.mac.plist}"

if [[ -z "$APP_PATH" ]]; then
  echo "usage: $0 <path-to-.app>" >&2
  exit 1
fi
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: must run on macOS (codesign / notarytool / stapler are macOS-only)." >&2
  exit 1
fi
if [[ ! -d "$APP_PATH" || "${APP_PATH##*.}" != "app" ]]; then
  echo "error: '$APP_PATH' is not a .app bundle." >&2
  exit 1
fi
if [[ -z "${APPLE_IDENTITY:-}" ]]; then
  echo "error: APPLE_IDENTITY is not set." >&2
  exit 1
fi
if [[ ! -f "$ENTITLEMENTS" ]]; then
  echo "error: entitlements file not found: $ENTITLEMENTS" >&2
  exit 1
fi

APP_NAME="$(basename "$APP_PATH" .app)"
APP_DIR="$(cd "$(dirname "$APP_PATH")" && pwd)"
ZIP_PATH="$APP_DIR/${APP_NAME// /-}-notarize.zip"

echo "▸ signing nested binaries"
# Sign innermost first: helpers, frameworks, then nested .apps
find "$APP_PATH" \
  \( -name '*.dylib' -o -name '*.so' -o -name '*.framework' -o -name '*.app' \) \
  -not -path "$APP_PATH" -print0 | \
  while IFS= read -r -d '' target; do
    codesign --force --options runtime --timestamp \
      --entitlements "$ENTITLEMENTS" \
      --sign "$APPLE_IDENTITY" "$target"
  done

echo "▸ signing main bundle"
codesign --force --options runtime --timestamp \
  --entitlements "$ENTITLEMENTS" \
  --sign "$APPLE_IDENTITY" "$APP_PATH"

echo "▸ verifying signature"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH" || true

if [[ "${SKIP_NOTARIZE:-0}" == "1" ]]; then
  echo "✅ signed (notarization skipped via SKIP_NOTARIZE=1)"
  exit 0
fi

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_TEAM_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  echo "error: APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD are required for notarization." >&2
  echo "       (set SKIP_NOTARIZE=1 to sign only.)" >&2
  exit 1
fi

echo "▸ zipping for notarytool"
rm -f "$ZIP_PATH"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

echo "▸ submitting to Apple notary service (this may take a few minutes)"
xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --wait

echo "▸ stapling ticket to .app"
xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"

# Clean up the notarization-only zip; final distributable artifacts are
# produced by `npm run release:mac`.
rm -f "$ZIP_PATH"

echo
echo "✅ signed, notarized, and stapled: $APP_PATH"
