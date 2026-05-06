#!/usr/bin/env bash
# Build, (optionally) sign + notarize, then emit a DMG and a ZIP for
# distribution. Run on macOS Ã¢ÂÂ hdiutil and codesign are macOS-only.
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

if [[ -n "${PREBUILT_APP_PATH:-}" ]]; then
  # Universal-merge path: caller already produced a .app (via @electron/universal
  # against per-arch builds). Skip vite+packager and just stage it for signing.
  if [[ ! -d "$PREBUILT_APP_PATH" ]]; then
    echo "error: PREBUILT_APP_PATH=$PREBUILT_APP_PATH not found" >&2
    exit 1
  fi
  echo "Ã¢ÂÂ¸ using prebuilt .app Ã¢ÂÂ $PREBUILT_APP_PATH"
  rm -rf "$PKG_DIR"
  mkdir -p "$PKG_DIR"
  # Copy (don't move) so the caller's artifact is preserved for debugging.
  /usr/bin/ditto "$PREBUILT_APP_PATH" "$APP_PATH"
else
  echo "Ã¢ÂÂ¸ building Vite bundle"
  npx vite build

  # Set icon flag only if build/icon.icns exists
  ICON_FLAG=""
  [[ -f build/icon.icns ]] && ICON_FLAG="--icon=build/icon.icns"

  echo "Ã¢ÂÂ¸ packaging .app for darwin/${ARCH}"
  rm -rf "$PKG_DIR"
  npx @electron/packager . "$APP_NAME" \
    --platform=darwin --arch="$ARCH" \
    --out="$OUT_DIR" --overwrite \
    ${ICON_FLAG:+$ICON_FLAG} \
    --app-bundle-id="$BUNDLE_ID" \
    --app-category-type=public.app-category.productivity \
    --app-version="$APP_VERSION" \
    --build-version="$BUILD_NUMBER" \
    --app-copyright="ÃÂ© $(date +%Y) Snip Talk" \
    --extend-info="build/Info.plist.extend.plist" \
    --prune=true \
    --ignore="^/(src|public|supabase|release|node_modules/.cache)"
fi

# ---- Stamp the bundle's Info.plist with version metadata ----
INFO_PLIST="$APP_PATH/Contents/Info.plist"
if [[ -f "$INFO_PLIST" ]]; then
  echo "Ã¢ÂÂ¸ stamping Info.plist with build metadata"
  PB=/usr/libexec/PlistBuddy
  set_or_add() {
    local key="$1" type="$2" value="$3"
    "$PB" -c "Set :$key $value" "$INFO_PLIST" 2>/dev/null || \
      "$PB" -c "Add :$key $type $value" "$INFO_PLIST"
  }
  set_or_add CFBundleShortVersionString string "$APP_VERSION"
  set_or_add CFBundleVersion            string "$BUILD_NUMBER"
  set_or_add CFBundleGetInfoString      string "$VERSION_STAMP, ÃÂ© $(date +%Y) Snip Talk"
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
  echo "Ã¢ÂÂ¸ codesigning with ${APPLE_IDENTITY}"
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
  echo "Ã¢ÂÂ¸ APPLE_IDENTITY not set Ã¢ÂÂ producing UNSIGNED build (Gatekeeper will warn on first launch)"
fi

# ---- ZIP (always) ----
ZIP_NAME="${ARTIFACT_BASE}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"
echo "Ã¢ÂÂ¸ zipping Ã¢ÂÂ $ZIP_PATH"
rm -f "$ZIP_PATH"
( cd "$PKG_DIR" && /usr/bin/ditto -c -k --sequesterRsrc --keepParent "${APP_NAME}.app" "../$ZIP_NAME" )

# Notarization status, written into the manifest.
NOTARIZE_STATUS="skipped"
NOTARIZE_ZIP_ID=""
NOTARIZE_DMG_ID=""
NOTARIZE_LOG="$OUT_DIR/${ARTIFACT_BASE}.notarization.log"
: > "$NOTARIZE_LOG"

# Submit a file to notarytool, capture submission id, wait, fetch the log,
# and return non-zero if the final status isn't "Accepted".
notarize_file() {
  local file="$1"
  local label
  label="$(basename "$file")"
  echo "Ã¢ÂÂ¸ notarizing $label"
  local submit_out
  submit_out="$(xcrun notarytool submit "$file" \
      --apple-id "$APPLE_ID" \
      --team-id "$APPLE_TEAM_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --wait --output-format json 2>&1)" || { echo "$submit_out" | tee -a "$NOTARIZE_LOG"; return 1; }
  echo "$submit_out" | tee -a "$NOTARIZE_LOG" >/dev/null
  local id status
  id="$(echo "$submit_out" | /usr/bin/python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null || true)"
  status="$(echo "$submit_out" | /usr/bin/python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('status',''))" 2>/dev/null || true)"
  echo "   submission id: $id  status: $status" | tee -a "$NOTARIZE_LOG"
  if [[ -n "$id" ]]; then
    {
      echo "----- notarytool log: $label ($id) -----"
      xcrun notarytool log "$id" \
        --apple-id "$APPLE_ID" \
        --team-id "$APPLE_TEAM_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" 2>&1 || true
    } >> "$NOTARIZE_LOG"
  fi
  case "$label" in
    *.zip) NOTARIZE_ZIP_ID="$id" ;;
    *.dmg) NOTARIZE_DMG_ID="$id" ;;
  esac
  [[ "$status" == "Accepted" ]]
}

# ---- Notarize ZIP (requires signed build + Apple credentials) ----
NOTARIZE_REQUIRED=0
if [[ -n "${APPLE_IDENTITY:-}" && -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  NOTARIZE_REQUIRED=1
  if notarize_file "$ZIP_PATH"; then
    echo "Ã¢ÂÂ¸ stapling .app"
    xcrun stapler staple "$APP_PATH"
    xcrun stapler validate "$APP_PATH" | tee -a "$NOTARIZE_LOG"
    # re-zip so the staple ticket is included in the archive
    rm -f "$ZIP_PATH"
    ( cd "$PKG_DIR" && /usr/bin/ditto -c -k --sequesterRsrc --keepParent "${APP_NAME}.app" "../$ZIP_NAME" )
    NOTARIZE_STATUS="accepted"
  else
    NOTARIZE_STATUS="failed"
    echo "::error::ZIP notarization failed Ã¢ÂÂ see $NOTARIZE_LOG" >&2
    exit 1
  fi
else
  echo "Ã¢ÂÂ¸ skipping notarization (set APPLE_IDENTITY + APPLE_ID + APPLE_TEAM_ID + APPLE_APP_SPECIFIC_PASSWORD to enable)"
fi

# ---- DMG (polished, native-feeling installer) ----
# Uses sindresorhus/create-dmg to produce a DMG with:
#   Ã¢ÂÂ¢ custom window size + icon positions (app on left, /Applications on right)
#   Ã¢ÂÂ¢ drag-arrow background image
#   Ã¢ÂÂ¢ the app's own .icns as the volume icon
#   Ã¢ÂÂ¢ hidden Finder sidebar / toolbar / status bar
# Falls back to a plain hdiutil DMG if create-dmg isn't available.
DMG_NAME="${ARTIFACT_BASE}.dmg"
DMG_PATH="$OUT_DIR/$DMG_NAME"
rm -f "$DMG_PATH"

build_pretty_dmg() {
  local out_dir
  out_dir="$(mktemp -d)/dmg-out"
  mkdir -p "$out_dir"
  echo "Ã¢ÂÂ¸ building polished DMG via create-dmg"
  # --no-code-sign: we sign the DMG ourselves below with our keychain identity.
  # --dmg-title keeps the mounted volume name short (Ã¢ÂÂ¤27 chars).
  npx --yes create-dmg@7 \
    --overwrite \
    --no-code-sign \
    --dmg-title="$APP_NAME" \
    "$APP_PATH" "$out_dir" >&2 || return 1
  local produced
  produced="$(ls "$out_dir"/*.dmg 2>/dev/null | head -n1)"
  [[ -f "$produced" ]] || return 1
  mv "$produced" "$DMG_PATH"
}

build_plain_dmg() {
  echo "Ã¢ÂÂ¸ building plain DMG via hdiutil (fallback)"
  local stage
  stage="$(mktemp -d)/dmg-stage"
  mkdir -p "$stage"
  cp -R "$APP_PATH" "$stage/"
  ln -s /Applications "$stage/Applications"
  hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$stage" \
    -ov -format UDZO \
    "$DMG_PATH"
}

if ! build_pretty_dmg; then
  echo "::warning::create-dmg failed, falling back to hdiutil"
  build_plain_dmg
fi
echo "Ã¢ÂÂ¸ DMG ready Ã¢ÂÂ $DMG_PATH"

# Sign + notarize + staple the DMG itself for Gatekeeper
if [[ -n "${APPLE_IDENTITY:-}" ]]; then
  codesign --force --sign "$APPLE_IDENTITY" --timestamp "$DMG_PATH"
  codesign --verify --verbose=2 "$DMG_PATH"
  if [[ "$NOTARIZE_REQUIRED" == "1" ]]; then
    if notarize_file "$DMG_PATH"; then
      xcrun stapler staple "$DMG_PATH"
      xcrun stapler validate "$DMG_PATH" | tee -a "$NOTARIZE_LOG"
      spctl --assess --type install --verbose=2 "$DMG_PATH" 2>&1 | tee -a "$NOTARIZE_LOG" || true
    else
      NOTARIZE_STATUS="failed"
      echo "::error::DMG notarization failed Ã¢ÂÂ see $NOTARIZE_LOG" >&2
      exit 1
    fi
  fi
fi

# ---- Final verification: assert the build matches its claimed status ----
if [[ "$NOTARIZE_REQUIRED" == "1" ]]; then
  echo "Ã¢ÂÂ¸ verifying notarization end-to-end"
  [[ "$NOTARIZE_STATUS" == "accepted" ]] || { echo "::error::notarization not accepted (status=$NOTARIZE_STATUS)"; exit 1; }
  [[ -n "$NOTARIZE_ZIP_ID" ]] || { echo "::error::missing ZIP submission id"; exit 1; }
  [[ -n "$NOTARIZE_DMG_ID" ]] || { echo "::error::missing DMG submission id"; exit 1; }
  [[ -s "$NOTARIZE_LOG"   ]] || { echo "::error::notarization log is empty: $NOTARIZE_LOG"; exit 1; }
  xcrun stapler validate "$APP_PATH" >/dev/null || { echo "::error::.app staple ticket invalid"; exit 1; }
  xcrun stapler validate "$DMG_PATH" >/dev/null || { echo "::error::DMG staple ticket invalid"; exit 1; }
  spctl --assess --type execute --verbose=2 "$APP_PATH" >/dev/null 2>&1 || { echo "::error::spctl rejected .app"; exit 1; }
  echo "Ã¢ÂÂ notarization verified (zip=$NOTARIZE_ZIP_ID dmg=$NOTARIZE_DMG_ID)"
fi

# ---- Detached signatures for the artifacts themselves ----
# The DMG is codesigned in-place above; the ZIP is opaque to codesign, so
# we emit detached .sig files for both so distributors can re-verify.
sign_artifact_detached "$ZIP_PATH"
sign_artifact_detached "$DMG_PATH"

# Export notarization metadata for the manifest writer to consume.
export NOTARIZE_STATUS NOTARIZE_ZIP_ID NOTARIZE_DMG_ID

# ---- Manifest with sha256 of every artifact + sibling SHASUMS file ----
write_release_manifest "$OUT_DIR/${ARTIFACT_BASE}.json" \
  "zip=$ZIP_PATH" "dmg=$DMG_PATH" \
  ${APPLE_IDENTITY:+"zip_sig=${ZIP_PATH}.sig" "dmg_sig=${DMG_PATH}.sig"}

echo
echo "Ã¢ÂÂ done Ã¢ÂÂ version $VERSION_STAMP"
echo "   $ZIP_PATH"
echo "   $DMG_PATH"
echo
echo "Verify:"
echo "  shasum -a 256 -c $OUT_DIR/${ARTIFACT_BASE}.SHASUMS"
[[ -n "${APPLE_IDENTITY:-}" ]] && echo "  codesign --verify --verbose=2 --detached ${ZIP_PATH}.sig $ZIP_PATH" || true
