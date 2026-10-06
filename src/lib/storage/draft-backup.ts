import { normalizeReport } from "@/lib/report/factory";
import type { WorkReport } from "@/lib/report/types";

import type { ReportRepository } from "./repository";

/**
 * Synchrone Notfall-Sicherung in localStorage.
 *
 * IndexedDB ist asynchron – wird die Seite in genau dem Moment geschlossen, kann der
 * letzte Schreibvorgang verloren gehen. Deshalb wird der gerade bearbeitete Bericht
 * zusätzlich synchron gesichert und beim nächsten Öffnen verwendet, falls er neuer ist.
 */
const PREFIX = "mm-arbeitsbericht-backup:";

export function writeDraftBackup(report: WorkReport): void {
  try {
    localStorage.setItem(PREFIX + report.id, JSON.stringify(report));
  } catch {
    // Speicher voll (z. B. große Unterschriften) – IndexedDB bleibt die Hauptablage.
  }
}

export function readDraftBackup(id: string): WorkReport | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as WorkReport) : null;
  } catch {
    return null;
  }
}

export function clearDraftBackup(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    // ignorieren
  }
}

/** Alle vorhandenen Notfall-Sicherungen. */
export function listDraftBackups(): WorkReport[] {
  const result: WorkReport[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const report = readDraftBackup(key.slice(PREFIX.length));
      if (report?.id && report.updatedAt) result.push(report);
    }
  } catch {
    // ohne localStorage gibt es nichts wiederherzustellen
  }
  return result;
}

/**
 * Übernimmt Sicherungen, die es nicht mehr in die Datenbank geschafft haben
 * (z. B. App direkt nach dem Tippen geschlossen). Gibt die Anzahl geretteter Berichte zurück.
 */
export async function recoverDraftBackups(repository: ReportRepository): Promise<number> {
  let recovered = 0;
  for (const backup of listDraftBackups()) {
    try {
      const stored = await repository.get(backup.id);
      if (!stored || backup.updatedAt > stored.updatedAt) {
        await repository.save(normalizeReport({ ...backup, reportNumber: backup.reportNumber ?? stored?.reportNumber }));
        recovered++;
      }
      clearDraftBackup(backup.id);
    } catch (error) {
      console.warn("Sicherung konnte nicht wiederhergestellt werden", error);
    }
  }
  return recovered;
}
