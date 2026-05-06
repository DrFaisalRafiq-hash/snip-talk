import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";

export function InstallIphoneButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      title="Install on iPhone"
      aria-label="Install on iPhone"
    >
      <Link to="/install">
        <Smartphone className="h-4 w-4" />
      </Link>
    </Button>
  );
}
