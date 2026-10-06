import { createId } from "@/lib/util/id";
import { isoWeekFromIsoDay, todayIso, workWeekRange } from "@/lib/util/dates";

import { deriveStatus } from "./status";
import type { WorkReport, WorkerEntry } from "./types";

export function createWorker(name = ""): WorkerEntry {
  return {
    id: createId(),
    name,
    hours: { mo: "", di: "", mi: "", do: "", fr: "", sa: "" },
  };
}

/** Neuer, leerer Bericht für die aktuelle Arbeitswoche. */
export function createEmptyReport(today: string = todayIso()): WorkReport {
  const week = workWeekRange(today);
  const now = new Date().toISOString();
  const report: WorkReport = {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    bauvorhaben: "",
    kw: String(isoWeekFromIsoDay(week?.from ?? today) ?? ""),
    dateFrom: week?.from ?? today,
    dateTo: week?.to ?? today,
    objekt: "",
    artDerArbeiten: "",
    workers: [createWorker()],
    description: "",
    completion: null,
    followUpNotes: "",
    ort: "",
    datum: today,
    monteurName: "",
    monteurSignature: null,
    kundeName: "",
    kundeSignature: null,
    status: "entwurf",
  };
  return report;
}

/**
 * Kopie für z. B. die Folgewoche auf derselben Baustelle.
 * Unterschriften und Nummer werden nicht übernommen.
 */
export function duplicateReport(source: WorkReport): WorkReport {
  const now = new Date().toISOString();
  const copy: WorkReport = {
    ...structuredClone(source),
    id: createId(),
    number: undefined,
    createdAt: now,
    updatedAt: now,
    workers: source.workers.map((w) => ({ ...w, id: createId(), hours: { ...w.hours } })),
    monteurSignature: null,
    kundeSignature: null,
    syncedAt: undefined,
  };
  copy.status = deriveStatus(copy);
  return copy;
}

/** Ergänzt fehlende Felder älterer gespeicherter Berichte (Schema-Migration light). */
export function normalizeReport(raw: Partial<WorkReport> & { id: string }): WorkReport {
  const base = createEmptyReport();
  const merged: WorkReport = {
    ...base,
    ...raw,
    workers: (raw.workers ?? base.workers).map((w) => ({
      ...createWorker(),
      ...w,
      hours: { ...createWorker().hours, ...w.hours },
    })),
  };
  merged.status = deriveStatus(merged);
  return merged;
}
