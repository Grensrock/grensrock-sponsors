"use client";

import { PICK_PATH } from "@/components/ui/PickLogo";

/* House-style background: thin colored plectrum outlines on black */
export default function PickLines() {
  const picks = [
    { c: "#4A90C4", x: -60, y: -40, s: 3.2, r: 12 },
    { c: "#C9518D", x: 180, y: -80, s: 2.6, r: -25 },
    { c: "#C9C463", x: 420, y: -30, s: 3.6, r: 40 },
    { c: "#DE8140", x: 620, y: 60, s: 2.8, r: -10 },
    { c: "#4FA05F", x: -40, y: 260, s: 2.9, r: 65 },
    { c: "#C9518D", x: 300, y: 330, s: 3.4, r: -50 },
    { c: "#4A90C4", x: 560, y: 300, s: 2.5, r: 20 },
    { c: "#DE8140", x: 120, y: 120, s: 2.2, r: 95 },
    { c: "#C9C463", x: 660, y: -90, s: 2.3, r: -70 },
  ];
  return (
    <svg className="gr-picklines" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {picks.map((p, i) => (
        <path
          key={i}
          d={PICK_PATH}
          fill="none"
          stroke={p.c}
          strokeWidth={1.6 / p.s}
          transform={`translate(${p.x} ${p.y}) scale(${p.s}) rotate(${p.r} 50 50)`}
        />
      ))}
    </svg>
  );
}
