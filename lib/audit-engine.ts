/* ============================================================
   AUDIT TRAIL
   ============================================================
   Every save runs the previous and next state through a diff so changes are
   logged automatically — no handler has to remember to log anything. Entries
   are capped so the log can never outgrow the storage limit. */

import { SNAPSHOT_FIELDS, isAccepted } from "@/lib/acceptance";
import { AUDIT_MAX, COMMS, VOUCHER_STATUS, uid, type CommKey } from "@/lib/constants";
import { contactName } from "@/lib/contacts";
import { userName } from "@/lib/users";
import type { AppData, AuditActor, AuditEntity, AuditEntry, Deal, VoucherStatus } from "@/types";

export { AUDIT_MAX };

export const auditActorLabel = (actor?: AuditActor | null) =>
  actor?.type === "sponsor"
    ? `${actor.name || "sponsor"} (sponsor)`
    : actor?.name
      ? `${actor.name} (team)`
      : "system";

export const auditFieldList = <T extends object>(
  before: T | undefined,
  after: T | undefined,
  fields: Array<keyof T>,
): string[] => {
  const changed: string[] = [];
  for (const f of fields) {
    if (JSON.stringify(before?.[f] ?? null) !== JSON.stringify(after?.[f] ?? null)) changed.push(String(f));
  }
  return changed;
};

/* Compare two datasets and return audit entries describing what changed */
export function diffForAudit(prev: AppData, next: AppData, actor?: AuditActor | null): AuditEntry[] {
  const now = new Date().toISOString();
  const out: AuditEntry[] = [];
  const add = (
    entity: AuditEntity,
    entityId: string,
    entityName: string,
    action: string,
    detail?: string,
  ) =>
    out.push({
      id: uid(),
      at: now,
      actor: actor || { type: "system" },
      entity,
      entityId,
      entityName,
      action,
      detail: detail || "",
    });
  const byId = <T extends { id: string }>(arr?: T[]) => new Map((arr || []).map((x) => [x.id, x]));

  /* sponsors + contacts */
  const ps = byId(prev.sponsors),
    ns = byId(next.sponsors);
  for (const s of next.sponsors || []) {
    const old = ps.get(s.id);
    if (!old) {
      add("sponsor", s.id, s.companyName, "created");
    } else {
      const f = auditFieldList(old, s, [
        "companyName",
        "vatNumber",
        "street",
        "houseNumber",
        "postalCode",
        "city",
        "entityType",
        "responsibleId",
        "refRequired",
        "voucherContactId",
      ]);
      if (f.length) add("sponsor", s.id, s.companyName, "updated", f.join(", "));
      const pc = byId(old.contacts || []),
        nc = s.contacts || [];
      for (const c of nc) {
        const oc = pc.get(c.id);
        if (!oc) add("contact", c.id, `${contactName(c)} · ${s.companyName}`, "created");
        else {
          const cf = auditFieldList(oc, c, ["firstName", "lastName", "email", "phone", "language"]);
          if (cf.length) add("contact", c.id, `${contactName(c)} · ${s.companyName}`, "updated", cf.join(", "));
          if (!oc.portalAccess && c.portalAccess)
            add("contact", c.id, `${contactName(c)} · ${s.companyName}`, "portal activated");
          if (oc.portalAccess && !c.portalAccess)
            add("contact", c.id, `${contactName(c)} · ${s.companyName}`, "portal deactivated");
          const op = (Object.keys(COMMS) as CommKey[]).filter((k) => oc.prefs?.[k]).join(",");
          const np = (Object.keys(COMMS) as CommKey[]).filter((k) => c.prefs?.[k]).join(",");
          if (op !== np)
            add("contact", c.id, `${contactName(c)} · ${s.companyName}`, "preferences changed", np || "none");
        }
      }
      const ncIds = new Set(nc.map((c) => c.id));
      for (const c of old.contacts || [])
        if (!ncIds.has(c.id)) add("contact", c.id, `${contactName(c)} · ${s.companyName}`, "deleted");
    }
  }
  for (const s of prev.sponsors || []) if (!ns.has(s.id)) add("sponsor", s.id, s.companyName, "deleted");

  /* agreements */
  const pd = byId(prev.deals),
    nd = byId(next.deals);
  const nameFor = (d: Deal, src: AppData) => {
    const sp = (src.sponsors || []).find((x) => x.id === d.sponsorId);
    const ed = (src.editions || []).find((x) => x.id === d.editionId);
    return `${sp?.companyName || "?"} · ${ed?.name || "?"}`;
  };
  for (const d of next.deals || []) {
    const old = pd.get(d.id);
    if (!old)
      add(
        "agreement",
        d.id,
        nameFor(d, next),
        d.requestedAt ? "requested by sponsor" : "created",
        d.formulaName || "custom",
      );
    else {
      const f = auditFieldList(old, d, [...SNAPSHOT_FIELDS]);
      if (f.length) add("agreement", d.id, nameFor(d, next), "updated", f.join(", "));
      if (!isAccepted(old) && isAccepted(d))
        add("agreement", d.id, nameFor(d, next), "accepted", `by ${d.acceptance?.name || ""}`);
      if (isAccepted(old) && !isAccepted(d)) add("agreement", d.id, nameFor(d, next), "acceptance reset");
      if (!old.confirmedAt && d.confirmedAt) add("agreement", d.id, nameFor(d, next), "confirmed");
    }
  }
  for (const d of prev.deals || []) if (!nd.has(d.id)) add("agreement", d.id, nameFor(d, prev), "deleted");

  /* editions */
  const pe = byId(prev.editions),
    ne = byId(next.editions);
  for (const e of next.editions || []) {
    const old = pe.get(e.id);
    if (!old) add("edition", e.id, e.name, "created");
    else {
      if (old.active !== e.active) add("edition", e.id, e.name, e.active ? "activated" : "deactivated");
      const of = (old.formulas || []).map((x) => x.name).join(",");
      const nf = (e.formulas || []).map((x) => x.name).join(",");
      if (of !== nf) add("edition", e.id, e.name, "formulas changed", nf);
    }
  }
  for (const e of prev.editions || []) if (!ne.has(e.id)) add("edition", e.id, e.name, "deleted");

  /* vouchers: bulk status transitions */
  const pv = byId(prev.vouchers);
  const transitions: Partial<Record<VoucherStatus, number>> = {};
  for (const v of next.vouchers || []) {
    const old = pv.get(v.id);
    if (old && old.status !== v.status) transitions[v.status] = (transitions[v.status] || 0) + 1;
  }
  for (const [status, n] of Object.entries(transitions)) {
    add(
      "vouchers",
      "",
      `${n} voucher(s)`,
      `→ ${(VOUCHER_STATUS[status as VoucherStatus]?.label || status).toLowerCase()}`,
    );
  }

  /* team accounts */
  const pu = byId(prev.users),
    nu = byId(next.users);
  for (const u of next.users || []) {
    const old = pu.get(u.id);
    if (!old) add("account", u.id, userName(u), "created", u.role);
    else if (old.role !== u.role) add("account", u.id, userName(u), "role changed", u.role);
  }
  for (const u of prev.users || []) if (!nu.has(u.id)) add("account", u.id, userName(u), "deleted");

  return out;
}
