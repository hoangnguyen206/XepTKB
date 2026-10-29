/**
 * Plan persistence with record-level schema versioning (DOMAIN_MODEL §9, ADR-0010 §3).
 * Migration is deterministic and local; records that cannot be migrated are moved to `backups`
 * so the user can download or delete them — they are never sent anywhere.
 */
import { SCHEMA_VERSION, type Override, type Plan, type PlanPick } from "@ky-nay/domain";
import { idbDelete, idbEntries, idbMoveToBackup, idbPut } from "./db.js";

export const PLAN_RECORD_VERSION = SCHEMA_VERSION;
const KNOWN_VERSIONS = ["0.1.0", "0.2.0"] as const;

export type PlanRecord = { schemaVersion: string; storedAt: string; plan: Plan };

export type MigrationResult =
  | { kind: "ok"; plan: Plan; migrated: boolean; notes: string[] }
  | { kind: "newer"; schemaVersion: string }
  | { kind: "invalid"; reason: string };

export type BackupRecord = { reason: string; movedAt: string; record: unknown };

export type PlanLoadReport = {
  plans: Plan[];
  migrated: string[];
  notes: string[];
  quarantined: number;
  /** Records written by a newer app version: left untouched and not editable here. */
  newer: number;
};

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isPick(value: unknown): value is PlanPick {
  return isRecord(value) && typeof value.sectionId === "string" && value.sectionId.length > 0 && (value.group === undefined || typeof value.group === "string");
}

function isTargetedOverride(value: unknown): value is Override {
  return isRecord(value)
    && isRecord(value.target)
    && typeof value.target.sectionId === "string"
    && typeof value.target.sessionId === "string"
    && ["room", "campus", "day", "periods", "weeks", "lecturer"].includes(value.field as string)
    && ["registration", "user", "admin-correction"].includes(value.source as string)
    && "to" in value;
}

/** Structural check of a 0.2.0 Plan. Semantic checks (sections exist, groups…) need the dataset. */
export function isPlanShape(value: unknown): value is Plan {
  return isRecord(value)
    && typeof value.id === "string" && value.id.length > 0
    && typeof value.term === "string" && value.term.length > 0
    && typeof value.datasetVersion === "string" && value.datasetVersion.length > 0
    && typeof value.name === "string"
    && (value.planKind === "draft" || value.planKind === "final")
    && value.final === (value.planKind === "final")
    && Array.isArray(value.picks) && value.picks.every(isPick)
    && Array.isArray(value.overrides) && value.overrides.every(isTargetedOverride)
    && (value.cohort === undefined || typeof value.cohort === "string")
    && (value.week1 === undefined || (typeof value.week1 === "string" && ISO_DATE.test(value.week1)))
    && typeof value.createdAt === "string" && RFC3339_UTC.test(value.createdAt)
    && typeof value.updatedAt === "string" && RFC3339_UTC.test(value.updatedAt);
}

/** 0.1.0 had no `datasetVersion` and untargeted overrides (ADR-0009 compatibility section). */
function migrateFrom010(plan: Json): { plan: Json; notes: string[] } {
  const notes: string[] = [];
  const planKind = plan.planKind === "final" || plan.planKind === "draft" ? plan.planKind : plan.final === true ? "final" : "draft";
  const overrides = Array.isArray(plan.overrides) ? plan.overrides : [];
  const kept = overrides.filter(isTargetedOverride);
  if (kept.length !== overrides.length) notes.push(`${overrides.length - kept.length} chỉnh sửa cũ không gắn với buổi học cụ thể đã bị bỏ`);
  notes.push("phương án cũ chưa ghi phiên bản dữ liệu; hãy kiểm tra lại các lớp đã chọn");
  return { plan: { ...plan, datasetVersion: typeof plan.datasetVersion === "string" ? plan.datasetVersion : "unknown", planKind, final: planKind === "final", overrides: kept }, notes };
}

export function migratePlanRecord(record: unknown): MigrationResult {
  if (!isRecord(record) || typeof record.schemaVersion !== "string" || !isRecord(record.plan)) return { kind: "invalid", reason: "bản ghi không đúng định dạng" };
  const version = record.schemaVersion;
  if (!(KNOWN_VERSIONS as readonly string[]).includes(version)) {
    return compareVersions(version, PLAN_RECORD_VERSION) > 0 ? { kind: "newer", schemaVersion: version } : { kind: "invalid", reason: `phiên bản ${version} không được hỗ trợ` };
  }
  let plan: Json = record.plan;
  let notes: string[] = [];
  if (version === "0.1.0") ({ plan, notes } = migrateFrom010(plan));
  if (!isPlanShape(plan)) return { kind: "invalid", reason: "dữ liệu phương án không hợp lệ sau khi chuyển đổi" };
  return { kind: "ok", plan, migrated: version !== PLAN_RECORD_VERSION, notes };
}

export function planRecord(plan: Plan, storedAt: string): PlanRecord {
  return { schemaVersion: PLAN_RECORD_VERSION, storedAt, plan };
}

export async function loadPlans(db: IDBDatabase, now: () => string = () => new Date().toISOString()): Promise<PlanLoadReport> {
  const report: PlanLoadReport = { plans: [], migrated: [], notes: [], quarantined: 0, newer: 0 };
  for (const { key, value } of await idbEntries<unknown>(db, "plans")) {
    const result = migratePlanRecord(value);
    if (result.kind === "newer") {
      report.newer += 1;
      continue;
    }
    if (result.kind === "invalid") {
      const backup: BackupRecord = { reason: result.reason, movedAt: now(), record: value };
      await idbMoveToBackup(db, "plans", key, backup);
      report.quarantined += 1;
      continue;
    }
    if (result.migrated) {
      await idbPut(db, "plans", planRecord(result.plan, now()), result.plan.id);
      if (key !== result.plan.id) await idbDelete(db, "plans", key);
      report.migrated.push(result.plan.id);
      report.notes.push(...result.notes);
    }
    report.plans.push(result.plan);
  }
  return report;
}

export async function savePlan(db: IDBDatabase, plan: Plan, now: () => string = () => new Date().toISOString()): Promise<void> {
  await idbPut(db, "plans", planRecord(plan, now()), plan.id);
}

export async function listBackups(db: IDBDatabase): Promise<{ key: IDBValidKey; value: BackupRecord }[]> {
  return idbEntries<BackupRecord>(db, "backups");
}

export async function deleteBackup(db: IDBDatabase, key: IDBValidKey): Promise<void> {
  await idbDelete(db, "backups", key);
}
