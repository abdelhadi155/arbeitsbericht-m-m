/** Datums-Helfer. Alle Daten werden als lokale ISO-Tage (yyyy-mm-dd) gespeichert. */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDay(value: string): Date | null {
  const m = ISO_DAY.exec(value);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return toIsoDay(new Date());
}

/** ISO-8601-Kalenderwoche (Woche mit dem ersten Donnerstag ist KW 1). */
export function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export function isoWeekFromIsoDay(value: string): number | null {
  const date = parseIsoDay(value);
  return date ? isoWeek(date).week : null;
}

/** Montag und Samstag der Woche, in der das Datum liegt. */
export function workWeekRange(value: string): { from: string; to: string } | null {
  const date = parseIsoDay(value);
  if (!date) return null;
  const offset = (date.getDay() + 6) % 7; // Montag = 0
  const monday = new Date(date);
  monday.setDate(date.getDate() - offset);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return { from: toIsoDay(monday), to: toIsoDay(saturday) };
}

/** 2026-10-06 → 06.10.2026 */
export function formatDateDe(value: string): string {
  const date = parseIsoDay(value);
  if (!date) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTimeDe(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
