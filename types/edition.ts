import type { FormulaFields } from "./deal";

/* A formula's primary key is its name — unique within its edition. */
export interface Formula extends FormulaFields {
  name: string;
  /** #rrggbb, or "" when none was picked (lib/color.ts). */
  color?: string;
}

export interface Edition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  active: boolean;
  formulas: Formula[];
}
