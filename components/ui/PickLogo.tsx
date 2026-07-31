"use client";

/* Grensrock plectrum logo, drawn to match the brand mark */
export const PICK_PATH = "M50 2 C70 4 88 22 93 45 C98 68 84 90 58 96 C32 102 8 88 4 62 C0 36 18 8 50 2 Z";

export default function PickLogo({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="Grensrock" role="img">
      <path d={PICK_PATH} fill="#FFFFFF" />
      <text
        x="49"
        y="49"
        textAnchor="middle"
        fill="#0B0B0B"
        style={{ font: "900 17px Montserrat, sans-serif", letterSpacing: ".5px" }}
      >
        GRENS
      </text>
      <text
        x="49"
        y="67"
        textAnchor="middle"
        fill="#0B0B0B"
        style={{ font: "900 17px Montserrat, sans-serif", letterSpacing: ".5px" }}
      >
        ROCK
      </text>
    </svg>
  );
}
