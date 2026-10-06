import type { WorkReport } from "@/lib/report/types";

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
