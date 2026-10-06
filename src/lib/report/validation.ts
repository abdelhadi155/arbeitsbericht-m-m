import { WEEKDAYS, type WorkReport } from "./types";
import { isValidHours } from "./hours";

/** Feldschlüssel, die im Formular markiert werden können. */
export type ValidationField =
  | "bauvorhaben"
  | "dateFrom"
  | "dateTo"
  | "workers"
  | "hours"
  | "description"
  | "completion"
  | "followUpNotes";

export interface ValidationIssue {
  field: ValidationField;
  message: string;
}

/**
 * Pflichtangaben für einen fertigen Bericht.
 * Ein Bericht mit Fehlern bleibt trotzdem als Entwurf speicherbar.
 */
export function validateReport(report: WorkReport): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!report.bauvorhaben.trim()) {
    issues.push({ field: "bauvorhaben", message: "Bauvorhaben fehlt" });
  }
  if (!report.dateFrom) {
    issues.push({ field: "dateFrom", message: "Datum (von) fehlt" });
  }
  if (report.dateFrom && report.dateTo && report.dateTo < report.dateFrom) {
    issues.push({ field: "dateTo", message: "„bis“ liegt vor „von“" });
  }

  const namedWorkers = report.workers.filter((w) => w.name.trim());
  if (namedWorkers.length === 0) {
    issues.push({ field: "workers", message: "Mindestens ein Monteur fehlt" });
  }

  const invalidHours = report.workers.some((w) => WEEKDAYS.some((d) => !isValidHours(w.hours[d])));
  if (invalidHours) {
    issues.push({ field: "hours", message: "Ungültige Stundenangabe (0–24, z. B. 7,5)" });
  }

  if (!report.description.trim()) {
    issues.push({ field: "description", message: "Beschreibung der Arbeiten fehlt" });
  }
  if (!report.completion) {
    issues.push({ field: "completion", message: "Status (abgeschlossen / weitere Arbeiten) fehlt" });
  }

  return issues;
}

export function issuesByField(issues: ValidationIssue[]): Partial<Record<ValidationField, string>> {
  const map: Partial<Record<ValidationField, string>> = {};
  for (const issue of issues) map[issue.field] ??= issue.message;
  return map;
}
