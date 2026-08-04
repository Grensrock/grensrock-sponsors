"use client";

/* Plectrum outline. No longer part of the logo — the mark is the wordmark
   below — but PickLines still draws the landing background out of it. */
export const PICK_PATH = "M50 2 C70 4 88 22 93 45 C98 68 84 90 58 96 C32 102 8 88 4 62 C0 36 18 8 50 2 Z";

/* ---------- Grensrock wordmark ----------
   Two lines, centred, set tight. The box comes from real Montserrat 900 metrics
   rather than being eyeballed: "GRENS" measures 364.8 and "ROCK" 309.5 at a
   100px size, on a 71.6 cap height.

   It draws in currentColor, which matters more than it looks. The wordmark is
   black and both surfaces it sits on — the app header and the landing page —
   are black, so a fixed fill would put a black logo on a black background.
   Inheriting makes it white there and black anywhere light. */
const W = 365;
const H = 156;
const LINE = { font: "900 100px Montserrat, sans-serif" } as const;

export default function PickLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={(size * W) / H}
      height={size}
      className="gr-logo"
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
      aria-label="Grensrock"
      role="img"
      fill="currentColor"
    >
      <text x={W / 2} y="71.6" textAnchor="middle" style={LINE}>
        GRENS
      </text>
      <text x={W / 2} y="152" textAnchor="middle" style={LINE}>
        ROCK
      </text>
    </svg>
  );
}
