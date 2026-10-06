import { normalizeReport } from "@/lib/report/factory";
import { MemoryReportNumberCounter, withReportNumber, type ReportNumberCounter } from "@/lib/report/report-number";
import { deriveStatus } from "@/lib/report/status";
import type { WorkReport } from "@/lib/report/types";

import type { ReportRepository } from "./repository";

/** Flüchtiger Speicher – für Tests und als Vorlage für weitere Implementierungen. */
export class MemoryReportRepository implements ReportRepository {
  private readonly rows = new Map<string, WorkReport>();

  constructor(private readonly counter: ReportNumberCounter = new MemoryReportNumberCounter()) {}

  async list() {
    return [...this.rows.values()].map((r) => normalizeReport(structuredClone(r))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) {
    const row = this.rows.get(id);
    return row ? normalizeReport(structuredClone(row)) : null;
  }

  async save(report: WorkReport) {
    const numbered = withReportNumber(report, [...this.rows.values()], this.counter);
    const toSave = { ...numbered, status: deriveStatus(numbered) };
    this.rows.set(toSave.id, structuredClone(toSave));
    return toSave;
  }

  async delete(id: string) {
    this.rows.delete(id);
  }
}
