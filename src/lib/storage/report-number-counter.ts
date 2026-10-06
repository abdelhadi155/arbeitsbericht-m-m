import { MemoryReportNumberCounter, type ReportNumberCounter } from "@/lib/report/report-number";

const KEY = "mm-arbeitsbericht-nummern";

/** Zähler im localStorage, damit gelöschte Nummern nicht erneut vergeben werden. */
export class LocalStorageReportNumberCounter implements ReportNumberCounter {
  private fallback = new MemoryReportNumberCounter();

  private read(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    } catch {
      return {};
    }
  }

  last(year: number): number {
    return Math.max(this.read()[year] ?? 0, this.fallback.last(year));
  }

  remember(year: number, sequence: number): void {
    this.fallback.remember(year, sequence);
    try {
      const data = this.read();
      data[year] = Math.max(data[year] ?? 0, sequence);
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Ohne localStorage greift der Speicher-Zähler; Nummern bleiben dank Bestandsabgleich eindeutig.
    }
  }
}
