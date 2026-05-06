# Run as a Mac desktop app (Electron)

After exporting this project to GitHub and pulling locally:

## 1. Install dev dependencies

```bash
npm install
npm install --save-dev electron @electron/packager
```

## 2. Add scripts to `package.json`

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "electron:dev": "ELECTRON_START_URL=http://localhost:8080 electron .",
    "electron:build": "vite build && electron .",
    "electron:package:mac": "vite build && electron-packager . Scribe --platform=darwin --arch=arm64 --out=release --overwrite --icon=public/favicon.png",
    "electron:package:mac-intel": "vite build && electron-packager . Scribe --platform=darwin --arch=x64 --out=release --overwrite --icon=public/favicon.png"
  }
}
```

> Set `"main": "electron/main.cjs"` at the top level of package.json (sibling of `scripts`).

## 3. Develop with hot reload

Terminal A:
```bash
npm run dev
```

Terminal B:
```bash
npm run electron:dev
```

## 4. Build & run packaged

```bash
npm run electron:build
```

## 5. Package as a `.app` bundle

Apple Silicon:
```bash
npm run electron:package:mac
```

Intel:
```bash
npm run electron:package:mac-intel
```

The `.app` will appear in `release/Scribe-darwin-*`.

## Notes

- `vite.config.ts` already sets `base: './'` in production so the bundle works under `file://`.
- Microphone permission is requested on first dictation — macOS will prompt automatically.
- For App Store / signed distribution use `electron-osx-sign` or `notarytool`.
