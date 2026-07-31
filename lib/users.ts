import { TEAM_DOMAIN } from "@/lib/constants";
import { normStr } from "@/lib/normalize";
import type { Sponsor, User } from "@/types";

export const isAdmin = (u?: User | null) => u?.role === "admin";

/* Team accounts use firstname@grensrock.be */
export const teamEmailFor = (firstName?: string) => {
  const slug = normStr(firstName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}@${TEAM_DOMAIN}` : "";
};

export const userName = (u?: Partial<User> | null) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() || u?.name || "";

/* Name of the team member responsible for a sponsor (falls back to legacy free text) */
export const responsibleName = (
  sponsor?: Pick<Sponsor, "responsibleId" | "responsible"> | null,
  users: User[] = [],
) => {
  const u = users.find((x) => x.id === sponsor?.responsibleId);
  return u ? userName(u) : sponsor?.responsible || "";
};

/* Old accounts stored a single name field */
export const withUserNames = (u: User): User => {
  if (u.firstName || u.lastName) return u;
  const parts = normStr(u.name).split(/\s+/).filter(Boolean);
  return { ...u, firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
};
