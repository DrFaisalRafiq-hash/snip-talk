// Single source of truth for the public release repository. Imported by
// MacDownload, ReleaseStatus, and updates so the slug can never drift.
export const GITHUB_REPO = "DrFaisalRafiq-hash/snip-talk";

export const GITHUB_API_LATEST_RELEASE = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
export const GITHUB_RELEASES_LATEST_URL = `${GITHUB_RELEASES_URL}/latest`;
