import type { WorkReport } from "./types";

/**
 * Berichtsnummern im Format AB-2026-0001.
 * Pro Kalenderjahr fortlaufend; einmal vergebene Nummern werden nie wiederverwendet
 * (auch nicht, wenn der Bericht gelöscht wurde).
 */
export const REPORT_NUMBER_PREFIX = "AB";
const PATTERN = /^AB-(\d{4})-(\d{4,})$/;

export function formatReportNumber(year: number, sequence: number): string {
  return `${REPORT_NUMBER_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseReportNumber(value: string | undefined): { year: number; sequence: number } | null {
  const m = value ? PATTERN.exec(value) : null;
  return m ? { year: Number(m[1]), sequence: Number(m[2]) } : null;
}

/** Merkt sich die zuletzt vergebene laufende Nummer je Jahr. */
export interface ReportNumberCounter {
  last(year: number): number;
  remember(year: number, sequence: number): void;
}

export function reportYear(report: Pick<WorkReport, "createdAt">): number {
  const year = new Date(report.createdAt).getFullYear();
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

/** Nächste freie Nummer: höher als alles Gespeicherte und alles bisher Vergebene. */
export function nextReportNumber(year: number, existing: WorkReport[], counter: ReportNumberCounter): string {
  const highestStored = existing.reduce((max, r) => {
    const parsed = parseReportNumber(r.reportNumber);
    return parsed && parsed.year === year ? Math.max(max, parsed.sequence) : max;
  }, 0);
  const sequence = Math.max(highestStored, counter.last(year)) + 1;
  counter.remember(year, sequence);
  return formatReportNumber(year, sequence);
}

/** Vergibt eine Nummer, falls der Bericht noch keine hat. Vorhandene Nummern bleiben unverändert. */
export function withReportNumber(report: WorkReport, existing: WorkReport[], counter: ReportNumberCounter): WorkReport {
  if (report.reportNumber) return report;
  return { ...report, reportNumber: nextReportNumber(reportYear(report), existing, counter) };
}

export class MemoryReportNumberCounter implements ReportNumberCounter {
  private readonly values = new Map<number, number>();
  last(year: number) {
    return this.values.get(year) ?? 0;
  }
  remember(year: number, sequence: number) {
    this.values.set(year, Math.max(this.last(year), sequence));
  }
}
