// CSP, navigation, and resource-load hardening shared by main + tray.
// Apply once on `app.whenReady()`; the helpers handle webRequest + permission
// gating. Keep this file the single source of truth for what hosts the
// renderer is allowed to talk to.
const { URL: NodeURL } = require("url");

// Origins the renderer is allowed to navigate to / talk to
const ALLOWED_ORIGINS = new Set([
  "https://urwovlmueuxgolccrjhb.supabase.co",
  "https://api.elevenlabs.io",
]);

const CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  "media-src 'self' blob:; " +
  "connect-src 'self' https://urwovlmueuxgolccrjhb.supabase.co wss://urwovlmueuxgolccrjhb.supabase.co https://api.elevenlabs.io wss://api.elevenlabs.io; " +
  "worker-src 'self' blob:; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';";

const TRAY_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob:; " +
  "connect-src 'self' https://urwovlmueuxgolccrjhb.supabase.co wss://urwovlmueuxgolccrjhb.supabase.co " +
  "https://api.elevenlabs.io wss://api.elevenlabs.io; " +
  "worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; object-src 'none';";

function safeUrl(value) {
  try {
    return value ? new NodeURL(value) : null;
  } catch {
    return null;
  }
}

// Inject the CSP + a few safe defaults on every renderer response.
function applyCspHeaders(session, csp = CSP, extra = {}) {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
        "X-Content-Type-Options": ["nosniff"],
        "Referrer-Policy": ["strict-origin-when-cross-origin"],
        ...extra,
      },
    });
  });
}

// Microphone is the only permission we genuinely need.
function applyMediaOnlyPermissions(session) {
  session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });
  session.setPermissionCheckHandler?.((_wc, permission) => permission === "media");
}

// Block any sub-resource load that isn't to a safe scheme or our allowlist.
function applyResourceLoadGuard(session, { devOriginEnv } = {}) {
  session.webRequest.onBeforeRequest((details, callback) => {
    const u = safeUrl(details.url);
    if (!u) return callback({});
    const okScheme =
      u.protocol === "file:" ||
      u.protocol === "data:" ||
      u.protocol === "blob:" ||
      u.protocol === "devtools:" ||
      u.protocol === "chrome-extension:";
    if (okScheme) return callback({});
    const devOrigin = safeUrl(process.env[devOriginEnv || "ELECTRON_START_URL"])?.origin;
    const okOrigin =
      ALLOWED_ORIGINS.has(u.origin) ||
      (devOrigin && u.origin === devOrigin) ||
      // websockets to allowlisted hosts
      ((u.protocol === "ws:" || u.protocol === "wss:") &&
        ALLOWED_ORIGINS.has(`https://${u.host}`));
    callback(okOrigin ? {} : { cancel: true });
  });
}

module.exports = {
  ALLOWED_ORIGINS,
  CSP,
  TRAY_CSP,
  safeUrl,
  applyCspHeaders,
  applyMediaOnlyPermissions,
  applyResourceLoadGuard,
};
