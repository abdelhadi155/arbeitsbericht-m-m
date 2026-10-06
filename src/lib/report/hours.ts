import { WEEKDAYS, type Weekday, type WorkReport, type WorkerEntry } from "./types";

export const MAX_HOURS_PER_DAY = 24;

/** „7,5“, „7.5“, „8“, „ 4 “ → Zahl. Leer → 0. Ungültig → NaN. */
export function parseHours(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  if (!/^\d{1,2}([.,]\d{1,2})?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(",", "."));
}

export function isValidHours(value: string): boolean {
  const n = parseHours(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_HOURS_PER_DAY;
}

/** Erlaubt während der Eingabe nur Ziffern und ein Dezimaltrennzeichen. */
export function sanitizeHoursInput(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [whole, ...rest] = cleaned.split(",");
  const decimals = rest.join("").slice(0, 2);
  return rest.length > 0 ? `${whole.slice(0, 2)},${decimals}` : whole.slice(0, 2);
}

function safeHours(value: string): number {
  return isValidHours(value) ? parseHours(value) : 0;
}

export function workerTotal(worker: WorkerEntry): number {
  return WEEKDAYS.reduce((sum, day) => sum + safeHours(worker.hours[day]), 0);
}

export function dayTotal(workers: WorkerEntry[], day: Weekday): number {
  return workers.reduce((sum, w) => sum + safeHours(w.hours[day]), 0);
}

export function reportTotal(report: Pick<WorkReport, "workers">): number {
  return report.workers.reduce((sum, w) => sum + workerTotal(w), 0);
}

/** 7.5 → „7,5“, 8 → „8“, 0 → „0“ */
export function formatHours(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}
