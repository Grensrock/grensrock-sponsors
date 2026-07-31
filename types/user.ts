import type { TeamLanguage } from "./contact";

export type Role = "admin" | "user";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  language: TeamLanguage;
  /** Legacy single name field from before first/last name existed. */
  name?: string;
}
