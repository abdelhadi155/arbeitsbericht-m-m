import type { WorkReport } from "@/lib/report/types";

/**
 * Speicher-Schnittstelle für Arbeitsberichte.
 *
 * Die App spricht ausschließlich mit diesem Interface. Heute steckt IndexedDB im Browser
 * dahinter; später kann z. B. ein SupabaseReportRepository (PostgreSQL) oder eine
 * Kombination „lokal + Synchronisierung“ eingesetzt werden, ohne die Oberfläche anzupassen.
 */
export interface ReportRepository {
  list(): Promise<WorkReport[]>;
  get(id: string): Promise<WorkReport | null>;
  save(report: WorkReport): Promise<WorkReport>;
  delete(id: string): Promise<void>;
}

/** Filter für spätere Suche nach Kunde/Baustelle, Zeitraum, Monteur. */
export interface ReportQuery {
  text?: string;
  from?: string;
  to?: string;
  workerName?: string;
}
