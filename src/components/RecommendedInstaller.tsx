// Auto-detected best installer for the user's Mac, shown above the full list.

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, Package } from "lucide-react";
import {
  getInstallInstructions,
  pickBest,
  pickOsFallback,
  type Arch,
} from "@/lib/mac-asset";
import { detectArch } from "@/lib/platform";
import { formatBytes } from "@/lib/format";

type ReleaseAsset = {
  name: string;
  size: number;
  browser_download_url: string;
};

export function RecommendedInstaller({ assets }: { assets: ReleaseAsset[] }) {
  const arch = useMemo<Arch>(() => detectArch(), []);
  const best = useMemo(() => pickBest(assets, arch) ?? pickOsFallback(assets), [assets, arch]);
  if (!best) return null;
  const info = getInstallInstructions(best.name);
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <Package className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground">
            Recommended for your Mac · {arch === "unknown" ? "auto-detect" : arch}
          </div>
          <div className="font-medium truncate" title={best.name}>
            {best.name}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {info.label} · {formatBytes(best.size)}
          </div>
        </div>
        <a href={best.browser_download_url} download={best.name} rel="noopener" className="shrink-0">
          <Button size="sm">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </a>
      </div>

      <ol className="mt-3 space-y-1.5 text-sm list-decimal list-inside marker:text-muted-foreground">
        {info.steps.map((s, i) => (
          <li key={i} className="text-foreground/90">
            {s}
          </li>
        ))}
      </ol>
      {info.note && <p className="mt-2 text-xs text-muted-foreground italic">{info.note}</p>}
    </div>
  );
}
