export type AuditActorType = "system" | "team" | "sponsor";

export interface AuditActor {
  type: AuditActorType;
  id?: string;
  name?: string;
}

export type AuditEntity = "sponsor" | "contact" | "agreement" | "edition" | "vouchers" | "account";

export interface AuditEntry {
  id: string;
  at: string;
  actor: AuditActor;
  entity: AuditEntity;
  entityId: string;
  entityName: string;
  action: string;
  detail: string;
}
