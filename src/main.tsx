import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { formatBuildLabel, getBuildInfo } from "./lib/buildInfo";

// Reflect the version stamp in the browser tab title for easier debugging.
// Electron locks the native window title in main.cjs, so this only affects
// the in-page <title> (visible in browser tabs and devtools).
try {
  const info = getBuildInfo();
  document.title = `Snip Talk · ${formatBuildLabel(info)}`;
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(<App />);
