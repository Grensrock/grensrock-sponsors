import type { CSSProperties } from "react";

/* ---------- Formula colours ----------
   Every formula of an edition has a colour (formulas.color, 0025): the buttons
   in the agreement form, the overview and the portal's formula cards are drawn
   in it. Stored as lowercase #rrggbb; "" means nobody picked one yet. */

/* The swatches the formula form offers: the festival's own colours, then the
   metals sponsor tiers tend to be named after. Any other colour is still one
   click away through the colour input next to them. 0025 backfills formulas
   named after a colour with these same values. */
export const FORMULA_COLORS = [
  "#4a90c4", // blue
  "#4fa05f", // green
  "#c9c463", // yellow
  "#de8140", // orange
  "#c9518d", // pink
  "#b3362b", // red
  "#2f6e9c", // deep blue
  "#c9a227", // gold
  "#9ea3a8", // silver
  "#a9713b", // bronze
  "#1c1a1c", // black
];

/* What a formula without a colour is drawn in. */
export const NO_FORMULA_COLOR = "#b9b4c0";

const HEX_RE = /^#[0-9a-f]{6}$/;

/** Anything that isn't #rrggbb becomes "" — the database rejects the rest. */
export const normColor = (v: unknown): string => {
  const s = String(v ?? "").trim().toLowerCase();
  return HEX_RE.test(s) ? s : "";
};

export const formulaColor = (f?: { color?: string } | null): string => normColor(f?.color) || NO_FORMULA_COLOR;

/* Text on a filled swatch: whichever of ink and white contrasts more with it
   (WCAG relative luminance, the two meet at about 0.18). */
export const textOn = (hex: string): string => {
  const c = normColor(hex) || NO_FORMULA_COLOR;
  const lin = (i: number) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  return lum > 0.18 ? "#1c1a1c" : "#fff";
};

/* The custom properties the .gr-fbtn / .gr-fdot / .gr-fcard styles draw with. */
export const formulaStyle = (f?: { color?: string } | null): CSSProperties => {
  const c = formulaColor(f);
  return { "--fc": c, "--fc-ink": textOn(c) } as CSSProperties;
};

/* The first swatch none of `taken` uses, so a new formula starts out different
   from its siblings. */
export const nextFormulaColor = (taken: (string | undefined)[]): string => {
  const used = new Set(taken.map(normColor));
  return FORMULA_COLORS.find((c) => !used.has(c)) || FORMULA_COLORS[0];
};
