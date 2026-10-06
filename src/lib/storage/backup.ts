import { normalizeReport } from "@/lib/report/factory";
import { WEEKDAYS, type WorkReport } from "@/lib/report/types";
import { toIsoDay } from "@/lib/util/dates";

/**
 * Datensicherung als JSON-Datei – solange die Berichte nur im Browser (IndexedDB) liegen,
 * die einzige Möglichkeit, sie vor Gerätewechsel oder gelöschten Browserdaten zu schützen.
 */
export const BACKUP_FORMAT = "mm-arbeitsbericht-sicherung";
export const BACKUP_VERSION = 1;
/** Schutz vor versehentlich gewählten Riesendateien. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface ReportBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: string;
  count: number;
  reports: WorkReport[];
}

export function createBackup(reports: WorkReport[], now = new Date()): ReportBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app: "M&M Arbeitsbericht",
    count: reports.length,
    reports,
  };
}

export function serializeBackup(backup: ReportBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(now = new Date()): string {
  return `Arbeitsberichte_Sicherung_${toIsoDay(now)}.json`;
}

export type ParseBackupResult = { ok: true; backup: ReportBackup } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isIsoTimestamp = (v: unknown) => isString(v) && !Number.isNaN(Date.parse(v));

function isValidSignature(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (!isRecord(v)) return false;
  if (!isString(v.dataUrl) || (v.dataUrl !== "" && !v.dataUrl.startsWith("data:image/png;base64,"))) return false;
  if (typeof v.width !== "number" || typeof v.height !== "number" || v.width <= 0 || v.height <= 0) return false;
  if (v.strokes !== undefined) {
    if (!Array.isArray(v.strokes)) return false;
    if (!v.strokes.every((s) => Array.isArray(s) && s.every((n) => typeof n === "number" && Number.isFinite(n)))) return false;
  }
  return true;
}

/** Prüft einen einzelnen Bericht; gibt eine Fehlerbeschreibung zurück oder null. */
function reportError(v: unknown): string | null {
  if (!isRecord(v)) return "kein Objekt";
  if (!isString(v.id) || v.id.length < 8) return "ID fehlt";
  if (!isIsoTimestamp(v.createdAt) || !isIsoTimestamp(v.updatedAt)) return "Zeitstempel ungültig";
  for (const key of ["bauvorhaben", "description"] as const) {
    if (!isString(v[key])) return `Feld „${key}“ fehlt`;
  }
  if (v.reportNumber !== undefined && !isString(v.reportNumber)) return "Berichtsnummer ungültig";
  if (!Array.isArray(v.workers)) return "Monteure fehlen";
  for (const w of v.workers) {
    if (!isRecord(w) || !isString(w.name) || !isRecord(w.hours)) return "Monteur-Eintrag ungültig";
    for (const day of WEEKDAYS) {
      if (w.hours[day] !== undefined && !isString(w.hours[day])) return "Stundenangabe ungültig";
    }
  }
  if (v.completion !== null && v.completion !== undefined && v.completion !== "abgeschlossen" && v.completion !== "weitere_arbeiten") {
    return "Status ungültig";
  }
  if (!isValidSignature(v.monteurSignature) || !isValidSignature(v.kundeSignature)) return "Unterschrift ungültig";
  return null;
}

/** Liest und validiert eine Sicherungsdatei. Ungültige Dateien werden komplett abgelehnt. */
export function parseBackup(text: string): ParseBackupResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "Die Datei ist zu groß." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Die Datei ist keine gültige JSON-Datei." };
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) {
    return { ok: false, error: "Das ist keine Sicherung der Arbeitsbericht-App." };
  }
  if (typeof data.version !== "number" || data.version > BACKUP_VERSION) {
    return { ok: false, error: "Die Sicherung stammt aus einer neueren App-Version." };
  }
  if (!Array.isArray(data.reports)) return { ok: false, error: "Die Sicherung enthält keine Berichte." };
  const ids = new Set<string>();
  for (let i = 0; i < data.reports.length; i++) {
    const error = reportError(data.reports[i]);
    if (error) return { ok: false, error: `Bericht ${i + 1} ist beschädigt (${error}).` };
    const id = (data.reports[i] as { id: string }).id;
    if (ids.has(id)) return { ok: false, error: `Bericht ${i + 1} ist doppelt enthalten.` };
    ids.add(id);
  }
  const reports = (data.reports as (Partial<WorkReport> & { id: string })[]).map((r) => normalizeReport(r));
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: data.version,
      exportedAt: isIsoTimestamp(data.exportedAt) ? (data.exportedAt as string) : "",
      app: isString(data.app) ? data.app : "",
      count: reports.length,
      reports,
    },
  };
}

export interface ImportPlan {
  /** Berichte, die es auf dem Gerät noch nicht gibt. */
  toAdd: WorkReport[];
  /** Gleiche ID, aber abweichender Inhalt – werden nur auf ausdrücklichen Wunsch ersetzt. */
  conflicts: { existing: WorkReport; incoming: WorkReport }[];
  /** Bereits identisch vorhanden – nichts zu tun. */
  unchanged: number;
}

export function planImport(existing: WorkReport[], incoming: WorkReport[]): ImportPlan {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const plan: ImportPlan = { toAdd: [], conflicts: [], unchanged: 0 };
  for (const report of incoming) {
    const current = byId.get(report.id);
    if (!current) plan.toAdd.push(report);
    else if (JSON.stringify(normalizeReport(current)) === JSON.stringify(normalizeReport(report))) plan.unchanged++;
    else plan.conflicts.push({ existing: current, incoming: report });
  }
  return plan;
}

export type ConflictMode = "keep" | "replace";

/** Berichte, die tatsächlich gespeichert werden. Vorhandene werden nur bei „replace“ überschrieben. */
export function reportsToWrite(plan: ImportPlan, mode: ConflictMode): WorkReport[] {
  return [...plan.toAdd, ...(mode === "replace" ? plan.conflicts.map((c) => c.incoming) : [])];
}
