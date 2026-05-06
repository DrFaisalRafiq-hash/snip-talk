import logo from "@/assets/logo.png";

export function Logo({ size = 40, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {animate && (
        <>
          <span
            className="absolute inset-0 rounded-full border border-foreground/40 animate-ping"
            style={{ animationDuration: "2s" }}
          />
          <span
            className="absolute inset-1 rounded-full border border-foreground/30 animate-ping"
            style={{ animationDuration: "2.6s", animationDelay: "0.4s" }}
          />
        </>
      )}
      <img
        src={logo}
        alt="Scribe logo"
        width={size}
        height={size}
        loading="lazy"
        className="relative z-10 object-contain"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
