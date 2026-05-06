#!/usr/bin/env node
/**
 * One-command dev runner: starts Vite, waits for it to be reachable, then
 * launches Electron pointed at the dev server. Vite HMR drives renderer
 * hot-reload; restart the script for main-process changes.
 *
 *   npm run electron
 */
const { spawn } = require("node:child_process");
const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = Number(process.env.VITE_PORT || 8080);
const URL = `http://${HOST}:${PORT}`;
const READY_TIMEOUT_MS = 30_000;

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const procs = [];

function spawnProc(cmd, args, env = {}) {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: false,
  });
  procs.push(p);
  return p;
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Vite not reachable at ${url} after ${timeoutMs}ms`));
        } else {
          setTimeout(tick, 300);
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tick();
  });
}

function shutdown(code = 0) {
  for (const p of procs) {
    if (!p.killed) {
      try {
        p.kill("SIGTERM");
      } catch {
        /* noop */
      }
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

(async () => {
  console.log(`▸ starting Vite on ${URL}`);
  const vite = spawnProc(npmCmd, ["run", "dev"], { VITE_PORT: String(PORT) });
  vite.on("exit", (code) => {
    console.log(`Vite exited (${code})`);
    shutdown(code ?? 0);
  });

  try {
    await waitForServer(URL, READY_TIMEOUT_MS);
  } catch (err) {
    console.error(err.message);
    shutdown(1);
    return;
  }

  console.log("▸ launching Electron");
  const electron = spawnProc(
    npmCmd,
    ["exec", "--", "electron", "."],
    { ELECTRON_START_URL: URL }
  );
  electron.on("exit", (code) => {
    console.log(`Electron exited (${code})`);
    shutdown(code ?? 0);
  });
})();
