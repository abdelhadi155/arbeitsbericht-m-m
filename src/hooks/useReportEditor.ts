"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createEmptyReport, normalizeReport } from "@/lib/report/factory";
import { deriveStatus } from "@/lib/report/status";
import type { WorkReport } from "@/lib/report/types";
import { getReportRepository } from "@/lib/storage";
import { clearDraftBackup, readDraftBackup, writeDraftBackup } from "@/lib/storage/draft-backup";

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 700;

type Updater = Partial<WorkReport> | ((current: WorkReport) => WorkReport);

/**
 * Lädt einen Bericht (oder legt einen neuen an) und speichert Änderungen automatisch.
 *
 * Schutz vor Datenverlust:
 * 1. jede Änderung wird sofort synchron in localStorage gesichert,
 * 2. kurz danach (Debounce) in IndexedDB gespeichert,
 * 3. beim Verlassen/Verstecken der Seite wird sofort gespeichert.
 */
export function useReportEditor(id: string | null) {
  const [report, setReport] = useState<WorkReport | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPersisted, setIsPersisted] = useState(false);

  const latest = useRef<WorkReport | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void> | null>(null);

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
      if (backup && (!stored || backup.updatedAt > stored.updatedAt)) {
        // Letzte Änderung hat es nicht mehr in die Datenbank geschafft → Sicherung verwenden.
        loaded = normalizeReport(backup);
        dirty.current = true;
      }
      if (cancelled) return;
      if (!loaded) {
        setNotFound(true);
        return;
      }
      latest.current = loaded;
      setReport(loaded);
      setIsPersisted(Boolean(stored));
      if (dirty.current) void persist();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel der ID neu laden
  }, [id]);

  const persist = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (saving.current) await saving.current;
    const current = latest.current;
    if (!current || !dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    const run = (async () => {
      try {
        await getReportRepository().save(current);
        if (latest.current === current) clearDraftBackup(current.id);
        setIsPersisted(true);
        setSaveState(dirty.current ? "pending" : "saved");
      } catch (error) {
        console.error("Speichern fehlgeschlagen", error);
        dirty.current = true;
        setSaveState("error");
      }
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, []);

  const update = useCallback(
    (updater: Updater) => {
      const current = latest.current;
      if (!current) return;
      const changed = typeof updater === "function" ? updater(current) : { ...current, ...updater };
      const next: WorkReport = { ...changed, updatedAt: new Date().toISOString() };
      next.status = deriveStatus(next);
      latest.current = next;
      dirty.current = true;
      setReport(next);
      setSaveState("pending");
      writeDraftBackup(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
    },
    [persist],
  );

  // Beim Verlassen sofort speichern
  useEffect(() => {
    const flush = () => {
      if (dirty.current && latest.current) {
        writeDraftBackup(latest.current);
        void persist();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    // Kein „Seite verlassen?“-Dialog: die synchrone Sicherung in localStorage reicht aus.
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [persist]);

  return { report, notFound, saveState, isPersisted, update, saveNow: persist };
}
