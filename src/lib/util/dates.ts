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

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 2026-10-06 → 06.10.2026 (unabhängig von Browser-Locale, ohne doppelte Punkte) */
export function formatDateDe(value: string): string {
  const date = parseIsoDay(value);
  if (!date) return "";
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Datum → 06.10. (für Spaltenköpfe) */
export function formatDayMonth(date: Date): string {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.`;
}

/** Die sechs Arbeitstage (Mo–Sa) der Woche, in der das Datum liegt. */
export function workWeekDays(value: string): Date[] {
  const range = workWeekRange(value);
  const monday = range ? parseIsoDay(range.from) : null;
  if (!monday) return [];
  return Array.from({ length: 6 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

/** ISO-Zeitstempel → 06.10.2026, 14:05 */
export function formatDateTimeDe(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
