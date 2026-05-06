export function Logo({ size = 40, animate = false }: { size?: number; animate?: boolean }) {
  // Three dots equalizer — turn on/off in red, like a stereo VU meter
  const dot = size * 0.28;
  const gap = size * 0.08;
  return (
    <div
      className="inline-flex items-end justify-center"
      style={{ width: size, height: size, gap }}
      aria-label="Snip Talk logo"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={animate ? "eq-dot" : ""}
          style={{
            width: dot,
            height: dot,
            borderRadius: "999px",
            background: "hsl(var(--signal))",
            display: "inline-block",
            opacity: animate ? undefined : 1,
            animationDelay: animate ? `${i * 0.18}s` : undefined,
            boxShadow: "0 0 0 1px hsl(0 0% 0% / 0.08)",
          }}
        />
      ))}
    </div>
  );
}
