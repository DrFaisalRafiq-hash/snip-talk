import { useMemo } from "react";
import { formatBuildLabel, getBuildInfo } from "@/lib/buildInfo";

export function VersionBadge({ className = "" }: { className?: string }) {
  const info = useMemo(() => getBuildInfo(), []);
  const label = formatBuildLabel(info);
  const tooltip = [
    `Version ${info.version}`,
    info.build && `Build ${info.build}`,
    info.commit && info.commit !== "nogit" && `Commit ${info.commit}`,
    info.builtAt && `Built ${info.builtAt}`,
    info.platform && info.arch && `${info.platform}/${info.arch}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span
      className={`font-mono-tight text-[10px] uppercase tracking-widest text-muted-foreground ${className}`}
      title={tooltip}
      aria-label={label}
    >
      {label}
    </span>
  );
}
