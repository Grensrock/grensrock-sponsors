import { supabase } from "@/lib/supabase/client";
import { orEmpty, unwrap, type Row } from "@/lib/api/util";
import type { AuditActorType, AuditEntity, AuditEntry } from "@/types";

/* ============================================================
   audit_log
   ============================================================
   Written exclusively by the log_audit() trigger (0005_audit.sql) and
   readable by admins only (0003_rls.sql) — there is nothing to write
   from the client any more, so this module is read-only.
   ============================================================ */

const COLUMNS = "id, at, actor_type, actor_id, actor_name, entity, entity_id, entity_name, action, detail";

export function rowToAuditEntry(row: Row): AuditEntry {
  return {
    id: String(row.id),
    at: orEmpty(row.at),
    actor: {
      type: (row.actor_type || "system") as AuditActorType,
      id: row.actor_id ? String(row.actor_id) : undefined,
      name: orEmpty(row.actor_name) || undefined,
    },
    entity: row.entity as AuditEntity,
    entityId: row.entity_id ? String(row.entity_id) : "",
    entityName: orEmpty(row.entity_name),
    action: orEmpty(row.action),
    detail: orEmpty(row.detail),
  };
}

export async function listAudit(limit = 1000): Promise<AuditEntry[]> {
  const rows = unwrap<Row[]>(
    await supabase.from("audit_log").select(COLUMNS).order("at", { ascending: false }).limit(limit),
  );
  return (rows as Row[]).map(rowToAuditEntry);
}
