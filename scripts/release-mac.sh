#!/usr/bin/env bash
# Build, (optionally) sign + notarize, then emit a DMG and a ZIP for
# distribution. Run on macOS — hdiutil and codesign are macOS-only.
#
#   ./scripts/release-mac.sh             # arm64 (Apple Silicon)
#   ARCH=x64 ./scripts/release-mac.sh    # Intel
#   ARCH=universal ./scripts/release-mac.sh
#
# Set these env vars to sign + notarize (otherwise the build is unsigned):
#   APPLE_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#   APPLE_ID="you@example.com"
#   APPLE_TEAM_ID="TEAMID"
#   APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
#
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: this script must run on macOS (hdiutil/codesign required)." >&2
  exit 1
fi

APP_NAME="Snip Talk"
BUNDLE_ID="com.sniptalk.app"
ARCH="${ARCH:-arm64}"
PLATFORM="darwin"
OUT_DIR="release"
ENTITLEMENTS="build/entitlements.mac.plist"

# Shared version stamp + build-info.json + VITE_APP_* env vars.
. "$(dirname "$0")/lib/version-stamp.sh"

PKG_DIR="$OUT_DIR/${APP_NAME}-${PLATFORM}-${ARCH}"
APP_PATH="$PKG_DIR/${APP_NAME}.app"

. "$(dirname "$0")/lib/release-manifest.sh"

echo "▸ building Vite bundle"
npx vite build

echo "▸ packaging .app for darwin/${ARCH}"
rm -rf "$PKG_DIR"
npx @electron/packager . "$APP_NAME" \
  --platform=darwin --arch="$ARCH" \
  --out="$OUT_DIR" --overwrite \
  --icon=build/icon.icns \
  --app-bundle-id="$BUNDLE_ID" \
  --app-category-type=public.app-category.productivity \
  --app-version="$APP_VERSION" \
  --build-version="$BUILD_NUMBER" \
  --app-copyright="© $(date +%Y) Snip Talk" \
  --extend-info="build/Info.plist.extend.plist" \
  --prune=true \
  --ignore="^/(src|public|electron|supabase|release|node_modules/.cache)"

# ---- Stamp the bundle's Info.plist with version metadata ----
INFO_PLIST="$APP_PATH/Contents/Info.plist"
if [[ -f "$INFO_PLIST" ]]; then
  echo "▸ stamping Info.plist with build metadata"
  PB=/usr/libexec/PlistBuddy
  set_or_add() {
    local key="$1" type="$2" value="$3"
    "$PB" -c "Set :$key $value" "$INFO_PLIST" 2>/dev/null || \
      "$PB" -c "Add :$key $type $value" "$INFO_PLIST"
  }
  set_or_add CFBundleShortVersionString string "$APP_VERSION"
  set_or_add CFBundleVersion            string "$BUILD_NUMBER"
  set_or_add CFBundleGetInfoString      string "$VERSION_STAMP, © $(date +%Y) Snip Talk"
  set_or_add SnipTalkBuildStamp         string "$VERSION_STAMP"
  set_or_add SnipTalkGitCommit          string "$GIT_SHA"
  set_or_add SnipTalkBuildNumber        string "$BUILD_NUMBER"
fi

# Drop build-info.json into the .app Resources so the runtime can read it.
RES_DIR="$APP_PATH/Contents/Resources"
if [[ -d "$RES_DIR" ]]; then
  cp build/build-info.json "$RES_DIR/build-info.json"
fi


# ---- Sign (Developer ID) ----
if [[ -n "${APPLE_IDENTITY:-}" ]]; then
  echo "▸ codesigning with ${APPLE_IDENTITY}"
  # Sign nested helpers / frameworks first, then the outer .app
  find "$APP_PATH" -name '*.dylib' -o -name '*.framework' -o -name '*.app' | \
    while read -r target; do
      codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$APPLE_IDENTITY" "$target"
    done
  codesign --force --options runtime --timestamp \
    --entitlements "$ENTITLEMENTS" \
    --sign "$APPLE_IDENTITY" "$APP_PATH"
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
else
  echo "▸ APPLE_IDENTITY not set — producing UNSIGNED build (Gatekeeper will warn on first launch)"
fi

# ---- ZIP (always) ----
ZIP_NAME="${ARTIFACT_BASE}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"
echo "▸ zipping → $ZIP_PATH"
rm -f "$ZIP_PATH"
( cd "$PKG_DIR" && /usr/bin/ditto -c -k --sequesterRsrc --keepParent "${APP_NAME}.app" "../$ZIP_NAME" )

# ---- Notarize (requires signed build + Apple credentials) ----
if [[ -n "${APPLE_IDENTITY:-}" && -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  echo "▸ notarizing"
  xcrun notarytool submit "$ZIP_PATH" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --wait
  echo "▸ stapling"
  xcrun stapler staple "$APP_PATH"
  # re-zip so the staple ticket is included in the archive
  rm -f "$ZIP_PATH"
  ( cd "$PKG_DIR" && /usr/bin/ditto -c -k --sequesterRsrc --keepParent "${APP_NAME}.app" "../$ZIP_NAME" )
else
  echo "▸ skipping notarization (set APPLE_ID + APPLE_TEAM_ID + APPLE_APP_SPECIFIC_PASSWORD to enable)"
fi

# ---- DMG ----
DMG_NAME="${ARTIFACT_BASE}.dmg"
DMG_PATH="$OUT_DIR/$DMG_NAME"
STAGE_DIR="$(mktemp -d)/dmg-stage"
mkdir -p "$STAGE_DIR"
cp -R "$APP_PATH" "$STAGE_DIR/"
ln -s /Applications "$STAGE_DIR/Applications"
echo "▸ building DMG → $DMG_PATH"
rm -f "$DMG_PATH"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGE_DIR" \
  -ov -format UDZO \
  "$DMG_PATH"

# Sign + staple the DMG itself for Gatekeeper
if [[ -n "${APPLE_IDENTITY:-}" ]]; then
  codesign --force --sign "$APPLE_IDENTITY" --timestamp "$DMG_PATH"
  if [[ -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
    echo "▸ notarizing DMG"
    xcrun notarytool submit "$DMG_PATH" \
      --apple-id "$APPLE_ID" \
      --team-id "$APPLE_TEAM_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --wait
    xcrun stapler staple "$DMG_PATH"
  fi
fi

echo
echo "✅ done — version $VERSION_STAMP"
echo "   $ZIP_PATH"
echo "   $DMG_PATH"

# Emit a small JSON manifest next to the artifacts for CI / auto-update tools.
MANIFEST="$OUT_DIR/${ARTIFACT_BASE}.json"
cat > "$MANIFEST" <<JSON
{
  "name": "$APP_NAME",
  "version": "$APP_VERSION",
  "build": "$BUILD_NUMBER",
  "commit": "$GIT_SHA",
  "dirty": $([[ -n "$GIT_DIRTY" ]] && echo true || echo false),
  "arch": "$ARCH",
  "platform": "darwin",
  "stamp": "$VERSION_STAMP",
  "artifacts": {
    "zip": "$(basename "$ZIP_PATH")",
    "dmg": "$(basename "$DMG_PATH")"
  }
}
JSON
echo "   $MANIFEST"
