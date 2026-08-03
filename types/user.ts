import type { TeamLanguage } from "./contact";

export type Role = "admin" | "user";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  /** False while the account is registered but still waiting for an admin. */
  approved: boolean;
  language: TeamLanguage;
  /** Legacy single name field from before first/last name existed. */
  name?: string;
}
