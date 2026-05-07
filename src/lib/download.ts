// Browser-side download helpers. Pure functions — no React, no toast.

export type DownloadAsset = { name: string; url: string; size?: number };

// Stream the asset into a Blob so the browser's download pipeline sees a real
// filename + the right MIME type. macOS Safari/Chrome will then offer "Open
// with DiskImageMounter" (.dmg) or auto-unzip (.zip), which is the closest a
// web page can get to "launching" an installer.
export async function downloadAsBlob(asset: DownloadAsset): Promise<boolean> {
  try {
    const res = await fetch(asset.url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const mime = asset.name.toLowerCase().endsWith(".dmg")
      ? "application/x-apple-diskimage"
      : "application/zip";
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = asset.name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return true;
  } catch {
    return false;
  }
}

// Anchor-click fallback. Relies on the server's `Content-Disposition: attachment`
// header — works even when CORS blocks the fetch above.
export function downloadViaAnchor(asset: DownloadAsset): void {
  const link = document.createElement("a");
  link.href = asset.url;
  link.download = asset.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Filename / size sanity checks for an installer asset before we hand it off
// to the browser. Catches the case where a release was published without a
// real binary (e.g. only checksums uploaded).
export function validateInstaller(
  asset: DownloadAsset,
): { ok: true } | { ok: false; reason: string } {
  const name = (asset.name ?? "").toLowerCase();
  if (!name) return { ok: false, reason: "Asset has no filename." };
  if (/\.(sig|asc|pem|sha256|sha512|shasums?|md5|json|txt|yml|yaml|xml)$/.test(name)) {
    return { ok: false, reason: `${asset.name} is a signature/checksum file, not an installer.` };
  }
  if (!/\.(dmg|zip)$/.test(name)) {
    return { ok: false, reason: `${asset.name} isn't a .dmg or .zip installer.` };
  }
  if (typeof asset.size === "number") {
    const MIN = 1 * 1024 * 1024;
    const MAX = 2 * 1024 * 1024 * 1024;
    if (asset.size < MIN) return { ok: false, reason: `${asset.name} looks too small (${asset.size} bytes).` };
    if (asset.size > MAX) return { ok: false, reason: `${asset.name} looks too large (${asset.size} bytes).` };
  }
  return { ok: true };
}
