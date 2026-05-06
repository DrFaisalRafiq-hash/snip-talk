# Snip Talk — macOS desktop app (Electron)

After exporting this project to GitHub and pulling locally:

## 1. Install

```bash
npm install
npm install --save-dev electron @electron/packager
```

> `package.json` already declares `"main": "electron/main.cjs"`, `"productName": "Snip Talk"`, and all `electron:*` scripts.

## 2. Develop with hot reload

Terminal A:
```bash
npm run dev
```

Terminal B:
```bash
npm run electron:dev
```

## 3. Run the packaged build locally

```bash
npm run electron:build
```

## 4. Package as a `.app`

Apple Silicon:
```bash
npm run electron:package:mac
```

Intel:
```bash
npm run electron:package:mac-intel
```

Universal (arm64 + x64):
```bash
npm run electron:package:mac-universal
```

Output: `release/Snip Talk-darwin-<arch>/Snip Talk.app`

### What's configured

| Setting | Value |
| --- | --- |
| App name | `Snip Talk` |
| Bundle ID | `com.sniptalk.app` |
| Category | `public.app-category.productivity` |
| Version | `0.1.0` (from package.json) |
| Icon | `build/icon.icns` (generated from `public/favicon.svg`) |
| Min macOS | 10.15 (Catalina) |

The main process (`electron/main.cjs`) calls `app.setName("Snip Talk")` and proactively requests microphone access via `systemPreferences.askForMediaAccess` on first launch so macOS shows its native prompt.

## 5. Deep links — `sniptalk://`

The app registers the `sniptalk://` URL scheme. Opening these URLs from Safari, Mail, Terminal (`open sniptalk://dictate`), or another app launches Snip Talk (or focuses it if already running) and switches to the right tab.

| URL | Effect |
| --- | --- |
| `sniptalk://dictate` | Focus the Dictation tab |
| `sniptalk://snippets` | Focus the Snippets tab |
| `sniptalk://dictate?text=hello` | Same, with query params for future use |

How it works:
- `build/Info.plist.extend.plist` registers `CFBundleURLTypes`, merged into the packaged `.app` via `electron-packager --extend-info`.
- `electron/main.cjs` enforces a single-instance lock and listens to `open-url` (macOS) + `second-instance` (Win/Linux), forwarding URLs to the renderer over IPC.
- `electron/preload.cjs` exposes `window.sniptalk.{onDeepLink, getInitialDeepLink}` to the renderer behind context isolation.
- `src/hooks/useDeepLink.ts` parses URLs and routes to the right tab.

For browser-only testing, append `?deeplink=sniptalk://snippets` to the preview URL.

## 6. Regenerating the icon

If you change `public/favicon.svg`, regenerate `build/icon.icns`:

```bash
# Requires librsvg + libicns (or use any tool that emits a multi-size .icns)
for s in 16 32 128 256 512 1024; do
  rsvg-convert -w $s -h $s public/favicon.svg -o /tmp/icon_${s}.png
done
png2icns build/icon.icns /tmp/icon_16.png /tmp/icon_32.png /tmp/icon_128.png /tmp/icon_256.png /tmp/icon_512.png /tmp/icon_1024.png
```

## 6. Signing & notarization (optional, for distribution)

The unsigned `.app` works locally (Gatekeeper will warn on first open — right-click → Open).
For distribution, sign and notarize with your Apple Developer ID:

```bash
codesign --deep --force --options runtime \
  --entitlements build/entitlements.mac.plist \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  "release/Snip Talk-darwin-arm64/Snip Talk.app"

xcrun notarytool submit "Snip Talk.zip" --apple-id you@example.com --team-id TEAMID --wait
xcrun stapler staple "release/Snip Talk-darwin-arm64/Snip Talk.app"
```

`build/entitlements.mac.plist` already enables microphone, network client, and JIT for the hardened runtime.

## Notes

- `vite.config.ts` sets `base: './'` so the bundle works under `file://`.
- Microphone permission: macOS prompts on first launch (via `askForMediaAccess`); the in-app status pill shows "Mic blocked" if the user denies.
- The `.app` bundle's `Info.plist` includes `NSMicrophoneUsageDescription` automatically via `@electron/packager`'s `--extend-info` — see `build/Info.plist.extend.plist` if you want to merge it manually.
