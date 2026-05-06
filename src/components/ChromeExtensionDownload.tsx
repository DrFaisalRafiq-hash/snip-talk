import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";
import { toast } from "sonner";

export function ChromeExtensionDownload() {
  const download = async () => {
    try {
      const res = await fetch("/snip-talk-extension.zip");
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "snip-talk-extension.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={download}
      title="Download Chrome extension"
      aria-label="Download Chrome extension"
    >
      <Chrome className="h-4 w-4" />
    </Button>
  );
}
