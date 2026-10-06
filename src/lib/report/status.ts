import type { ReportStatus, WorkReport } from "./types";
import { validateReport } from "./validation";

export function isSigned(report: WorkReport): boolean {
  return Boolean(
    report.monteurSignature &&
      report.monteurName.trim() &&
      report.kundeSignature &&
      report.kundeName.trim(),
  );
}

/**
 * Entwurf: Pflichtangaben fehlen.
 * Fertig: alle Pflichtangaben vorhanden.
 * Unterschrieben: fertig + Monteur und Kunde haben unterschrieben.
 */
export function deriveStatus(report: WorkReport): ReportStatus {
  if (validateReport(report).length > 0) return "entwurf";
  return isSigned(report) ? "unterschrieben" : "fertig";
}

export const STATUS_LABELS: Record<ReportStatus, string> = {
  entwurf: "Entwurf",
  fertig: "Fertig",
  unterschrieben: "Unterschrieben",
};
