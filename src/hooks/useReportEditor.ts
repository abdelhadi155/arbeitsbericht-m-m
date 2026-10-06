"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createEmptyReport, normalizeReport } from "@/lib/report/factory";
import { deriveStatus } from "@/lib/report/status";
import type { WorkReport } from "@/lib/report/types";
import { getReportRepository } from "@/lib/storage";
import { clearDraftBackup, readDraftBackup, writeDraftBackup } from "@/lib/storage/draft-backup";

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

/** Notfall-Sicherung (synchron, localStorage) – kurz entprellt, damit nicht jeder Tastendruck schreibt. */
const BACKUP_DELAY_MS = 400;
/** Eigentliches Speichern in IndexedDB. */
const SAVE_DELAY_MS = 1000;

type Updater = Partial<WorkReport> | ((current: WorkReport) => WorkReport);

/**
 * Lädt einen Bericht (oder legt einen neuen an) und speichert Änderungen automatisch.
 *
 * Schutz vor Datenverlust:
 * 1. Änderungen werden nach kurzer Tipp-Pause synchron in localStorage gesichert,
 * 2. etwas später in IndexedDB gespeichert,
 * 3. beim Schließen, Neuladen oder Wechsel in eine andere App wird beides sofort ausgeführt.
 * Ist die IndexedDB-Fassung älter als die Sicherung, wird beim nächsten Öffnen die Sicherung genommen.
 */
export function useReportEditor(id: string | null) {
  const [report, setReport] = useState<WorkReport | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPersisted, setIsPersisted] = useState(false);

  const latest = useRef<WorkReport | null>(null);
  const dirty = useRef(false);
  const backupDirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void> | null>(null);

  const writeBackupNow = useCallback(() => {
    if (backupTimer.current) {
      clearTimeout(backupTimer.current);
      backupTimer.current = null;
    }
    if (backupDirty.current && latest.current) {
      writeDraftBackup(latest.current);
      backupDirty.current = false;
    }
  }, []);

  const persist = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (saving.current) await saving.current;
    const current = latest.current;
    if (!current || !dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    const run = (async () => {
      try {
        const saved = await getReportRepository().save(current);
        // Beim ersten Speichern vergibt das Repository die Berichtsnummer.
        if (latest.current && saved.reportNumber && latest.current.reportNumber !== saved.reportNumber) {
          latest.current = { ...latest.current, reportNumber: saved.reportNumber };
          setReport(latest.current);
          if (latest.current !== current) backupDirty.current = true;
        }
        if (!dirty.current && !backupDirty.current) clearDraftBackup(current.id);
        setIsPersisted(true);
        setSaveState(dirty.current ? "pending" : "saved");
      } catch (error) {
        console.error("Speichern fehlgeschlagen", error);
        dirty.current = true;
        backupDirty.current = true;
        writeBackupNow();
        setSaveState("error");
      }
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [writeBackupNow]);

  /** Sofort sichern und speichern (vor PDF, Navigation, Verlassen der Seite). */
  const saveNow = useCallback(async () => {
    writeBackupNow();
    await persist();
  }, [persist, writeBackupNow]);

  // Laden
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        const fresh = createEmptyReport();
        latest.current = fresh;
        setReport(fresh);
        setIsPersisted(false);
        return;
      }
      const stored = await getReportRepository().get(id);
      const backup = readDraftBackup(id);
      let loaded = stored;
      let recovered = false;
      if (backup && (!stored || backup.updatedAt > stored.updatedAt)) {
        // Letzte Änderung hat es nicht mehr in die Datenbank geschafft → Sicherung verwenden.
        loaded = normalizeReport({ ...backup, reportNumber: backup.reportNumber ?? stored?.reportNumber });
        recovered = true;
      }
      if (cancelled) return;
      if (!loaded) {
        setNotFound(true);
        return;
      }
      latest.current = loaded;
      setReport(loaded);
      setIsPersisted(Boolean(stored));
      if (recovered) {
        dirty.current = true;
        void persist();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, persist]);

  const update = useCallback(
    (updater: Updater) => {
      const current = latest.current;
      if (!current) return;
      const changed = typeof updater === "function" ? updater(current) : { ...current, ...updater };
      const next: WorkReport = { ...changed, updatedAt: new Date().toISOString() };
      next.status = deriveStatus(next);
      latest.current = next;
      dirty.current = true;
      backupDirty.current = true;
      setReport(next);
      setSaveState("pending");
      if (backupTimer.current) clearTimeout(backupTimer.current);
      backupTimer.current = setTimeout(writeBackupNow, BACKUP_DELAY_MS);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(), SAVE_DELAY_MS);
    },
    [persist, writeBackupNow],
  );

  // Beim Verlassen sofort sichern (ohne „Seite verlassen?“-Dialog)
  useEffect(() => {
    const flush = () => {
      writeBackupNow();
      if (dirty.current) void persist();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [persist, writeBackupNow]);

  return { report, notFound, saveState, isPersisted, update, saveNow };
}
