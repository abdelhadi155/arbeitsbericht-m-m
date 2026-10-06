import { IndexedDbReportRepository } from "./indexeddb-repository";
import type { ReportRepository } from "./repository";

export type { ReportRepository, ReportQuery } from "./repository";

let repository: ReportRepository | null = null;

/**
 * Zentrale Stelle, an der das Speicher-Backend gewählt wird.
 * Für Supabase später z. B.: `if (process.env.NEXT_PUBLIC_SUPABASE_URL) return new SupabaseReportRepository(...)`.
 */
export function getReportRepository(): ReportRepository {
  repository ??= new IndexedDbReportRepository();
  return repository;
}
