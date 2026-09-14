"use client";

interface AgentAvatarProps {
  size?: number;
  className?: string;
  /** Set false for static contexts like a list row. */
  animated?: boolean;
}

/**
 * TRON's identity mark — an electric-blue core ring with a slow orbiting runner.
 * Drawn rather than loaded so it scales cleanly and ships no image weight.
 */
export default function AgentAvatar({
  size = 40,
  className = "",
  animated = true,
}: AgentAvatarProps) {
  const r = 21;
  const circumference = 2 * Math.PI * r;

  return (
    <div
      className={`relative rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 50% 32%, rgba(56,189,248,0.22), rgba(6,11,22,0.95) 72%)",
        boxShadow:
          "0 0 12px rgba(14,165,233,0.35), inset 0 0 10px rgba(56,189,248,0.14)",
      }}
      aria-label="TRON"
      role="img"
    >
      <svg viewBox="0 0 48 48" width={size} height={size} className="block">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(56,189,248,0.25)" strokeWidth="1.5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.16} ${circumference}`}
          className={animated ? "orb-dash-runner" : undefined}
          style={{ filter: "drop-shadow(0 0 3px rgba(56,189,248,0.9))" }}
        />
        <circle cx="24" cy="24" r="6.5" fill="none" stroke="rgba(125,211,252,0.65)" strokeWidth="1.25" />
        <circle cx="24" cy="24" r="2.4" fill="#7dd3fc" style={{ filter: "drop-shadow(0 0 4px #38bdf8)" }} />
      </svg>
    </div>
  );
}
