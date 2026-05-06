import { describe, it, expect } from "vitest";
import { isMacAsset, scoreMacAsset, pickBest, pickOsFallback } from "./mac-asset";

describe("isMacAsset", () => {
  it("accepts mac-tokened dmg/zip", () => {
    expect(isMacAsset("SnipTalk-1.0.0-mac.dmg")).toBe(true);
    expect(isMacAsset("SnipTalk-macos-arm64.zip")).toBe(true);
    expect(isMacAsset("snip.darwin.x64.zip")).toBe(true);
  });

  it("accepts arch-only mac builds", () => {
    expect(isMacAsset("SnipTalk-arm64.dmg")).toBe(true);
    expect(isMacAsset("SnipTalk-universal.dmg")).toBe(true);
  });

  it("rejects non-mac platforms and wrong extensions", () => {
    expect(isMacAsset("SnipTalk-win-x64.zip")).toBe(false);
    expect(isMacAsset("SnipTalk-linux-x64.zip")).toBe(false);
    expect(isMacAsset("SnipTalk-mac.exe")).toBe(false);
    expect(isMacAsset("readme.txt")).toBe(false);
  });
});

describe("scoreMacAsset", () => {
  it("rejects sidecars/checksums", () => {
    expect(scoreMacAsset("SnipTalk-mac.dmg.sig", "arm64")).toBe(-1);
    expect(scoreMacAsset("SHASUMS256.txt", "arm64")).toBe(-1);
    expect(scoreMacAsset("latest-mac.json", "arm64")).toBe(-1);
  });

  it("prefers DMG over ZIP", () => {
    const dmg = scoreMacAsset("SnipTalk-mac-arm64.dmg", "arm64");
    const zip = scoreMacAsset("SnipTalk-mac-arm64.zip", "arm64");
    expect(dmg).toBeGreaterThan(zip);
  });

  it("rewards arch match and penalizes wrong arch", () => {
    const armMatch = scoreMacAsset("SnipTalk-mac-arm64.dmg", "arm64");
    const x64Wrong = scoreMacAsset("SnipTalk-mac-x64.dmg", "arm64");
    expect(armMatch).toBeGreaterThan(x64Wrong);
  });

  it("rewards universal builds for any arch", () => {
    const uni = scoreMacAsset("SnipTalk-mac-universal.dmg", "arm64");
    const arm = scoreMacAsset("SnipTalk-mac-arm64.dmg", "arm64");
    // Arch-specific should still win, but universal beats wrong-arch.
    const x64 = scoreMacAsset("SnipTalk-mac-x64.dmg", "arm64");
    expect(arm).toBeGreaterThan(uni);
    expect(uni).toBeGreaterThan(x64);
  });
});

describe("pickBest", () => {
  const assets = [
    { name: "SnipTalk-1.0.0-mac-x64.dmg" },
    { name: "SnipTalk-1.0.0-mac-arm64.dmg" },
    { name: "SnipTalk-1.0.0-mac-arm64.zip" },
    { name: "SnipTalk-1.0.0-mac-arm64.dmg.sig" },
    { name: "SnipTalk-1.0.0-win-x64.exe" },
    { name: "SHASUMS256.txt" },
  ];

  it("selects arm64 dmg for arm64 preference", () => {
    expect(pickBest(assets, "arm64")?.name).toBe("SnipTalk-1.0.0-mac-arm64.dmg");
  });

  it("selects x64 dmg for x64 preference", () => {
    expect(pickBest(assets, "x64")?.name).toBe("SnipTalk-1.0.0-mac-x64.dmg");
  });

  it("returns null when nothing matches", () => {
    expect(pickBest([{ name: "win-installer.exe" }, { name: "readme.md" }], "arm64")).toBeNull();
  });
});

describe("pickOsFallback", () => {
  it("picks any mac-tokened dmg when no arch-specific asset exists", () => {
    const assets = [
      { name: "SnipTalk-mac.dmg" },
      { name: "SnipTalk-mac.zip" },
      { name: "SnipTalk-win.exe" },
    ];
    expect(pickOsFallback(assets)?.name).toBe("SnipTalk-mac.dmg");
  });

  it("excludes sidecars and other-OS files", () => {
    const assets = [
      { name: "SnipTalk-win-x64.zip" },
      { name: "SnipTalk-linux.zip" },
      { name: "SHASUMS256.txt" },
    ];
    expect(pickOsFallback(assets)).toBeNull();
  });
});
