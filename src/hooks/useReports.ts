"use client";

import { useCallback, useEffect, useState } from "react";

import { duplicateReport } from "@/lib/report/factory";
import type { WorkReport } from "@/lib/report/types";
import { getReportRepository } from "@/lib/storage";

export function useReports() {
  const [reports, setReports] = useState<WorkReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setReports(await getReportRepository().list());
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Die Arbeitsberichte konnten nicht geladen werden.");
      setReports([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = useCallback(
    async (id: string) => {
      await getReportRepository().delete(id);
      await reload();
    },
    [reload],
  );

  const duplicate = useCallback(
    async (report: WorkReport) => {
      const copy = await getReportRepository().save(duplicateReport(report));
      await reload();
      return copy;
    },
    [reload],
  );

  return { reports, error, reload, remove, duplicate };
}

/** Namen bisher eingetragener Monteure – für Vorschläge bei der Eingabe. */
export function useKnownWorkerNames(): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    getReportRepository()
      .list()
      .then((reports) => {
        const all = reports.flatMap((r) => [...r.workers.map((w) => w.name), r.monteurName]);
        setNames([...new Set(all.map((n) => n.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de")));
      })
      .catch(() => setNames([]));
  }, []);
  return names;
}
