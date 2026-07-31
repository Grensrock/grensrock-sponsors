/* Migration of previously stored data into the current shape.
   Kept in its own module so lib/normalize.ts stays dependency-free. */

import { withAddress } from "@/lib/address";
import { TEAM_LANGS } from "@/lib/constants";
import { withContacts, withVoucherContact } from "@/lib/contacts";
import { defaultTickoweb } from "@/lib/integrations/tickoweb";
import { defaultVies } from "@/lib/integrations/vies";
import { normBenefits, normStr } from "@/lib/normalize";
import { userName, withUserNames } from "@/lib/users";
import type {
  AppData,
  AuditEntry,
  Deal,
  Edition,
  Settings,
  Sponsor,
  StoredSponsor,
  StoredVoucher,
  TeamLanguage,
  User,
  Voucher,
} from "@/types";

export interface StoredAppData {
  sponsors?: StoredSponsor[];
  editions?: Edition[];
  deals?: Deal[];
  users?: User[];
  vouchers?: StoredVoucher[];
  audit?: AuditEntry[];
  settings?: Settings;
}

export const withPortalCodes = (data: StoredAppData): AppData => {
  /* `role` is a default for older records that predate roles — the spread wins when present. */
  const users = (data.users || []).map((u) =>
    withUserNames({ role: "user", ...(u as Partial<User>) } as User),
  );
  /* Old sponsors stored the responsible as free text — match it to an account where possible */
  const linkResponsible = (s: StoredSponsor): StoredSponsor => {
    if (s.responsibleId !== undefined) return s;
    const txt = normStr(s.responsible);
    const hit =
      txt &&
      users.find(
        (u) =>
          userName(u).toLowerCase() === txt.toLowerCase() ||
          normStr(u.firstName).toLowerCase() === txt.toLowerCase(),
      );
    return { ...s, responsibleId: hit ? hit.id : "" };
  };
  return {
    ...data,
    settings: {
      ...(data.settings || {}),
      tickoweb: { ...defaultTickoweb, ...(data.settings?.tickoweb || {}) },
      vies: { ...defaultVies, ...(data.settings?.vies || {}) },
    },
    users: users.map((u) => ({
      ...u,
      language: TEAM_LANGS[u.language as TeamLanguage] ? u.language : "nl",
    })),
    vouchers: (data.vouchers || []).map((v) => (v.type === "extra" ? { ...v, type: "food" } : v)) as Voucher[],
    editions: (data.editions || []) as Edition[],
    deals: (data.deals || []) as Deal[],
    sponsors: (data.sponsors || []).map((s) =>
      linkResponsible(withVoucherContact(withAddress(withContacts(s)))),
    ) as Sponsor[],
  };
};

export const migrate = (data: StoredAppData): AppData =>
  withPortalCodes({
    ...data,
    deals: (data.deals || []).map(normBenefits),
    editions: (data.editions || []).map((e) => ({ ...e, formulas: (e.formulas || []).map(normBenefits) })),
  });
