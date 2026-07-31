import type { Sponsor } from "./sponsor";
import type { Edition } from "./edition";
import type { Deal } from "./deal";
import type { Voucher } from "./voucher";
import type { User } from "./user";
import type { AuditEntry } from "./audit";
import type { Settings } from "./settings";

/* The one JSON blob everything is persisted in (grensrock:data:v1). */
export interface AppData {
  sponsors: Sponsor[];
  editions: Edition[];
  deals: Deal[];
  users: User[];
  vouchers?: Voucher[];
  audit?: AuditEntry[];
  settings?: Settings;
}

/* A translation function: t("nav.overview") -> string. */
export type TranslateFn = (key: string) => string;

/* Colour tone of a <Tag>. */
export type Tone = "grey" | "green" | "amber" | "blue";
