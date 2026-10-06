import { formatDateDe } from "@/lib/util/dates";

import type { WorkReport } from "./types";

/** Kurzinfos für Listen und Überschriften. */
export function reportTitle(report: WorkReport): string {
  return report.bauvorhaben.trim() || report.kundeName.trim() || "Ohne Bauvorhaben";
}

export function reportPeriod(report: WorkReport): string {
  const from = formatDateDe(report.dateFrom);
  const to = formatDateDe(report.dateTo);
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to || formatDateDe(report.datum);
}

export function reportWorkerNames(report: WorkReport): string[] {
  return report.workers.map((w) => w.name.trim()).filter(Boolean);
}
