"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { downloadReportPdf } from "@/lib/pdf/generate-report-pdf";
import { duplicateReport } from "@/lib/report/factory";
import { reportTitle } from "@/lib/report/summary";
import type { WorkReport } from "@/lib/report/types";
import { getReportRepository } from "@/lib/storage";

import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";

/** Gemeinsame Aktionen (PDF, Duplizieren, Löschen mit Sicherheitsabfrage) für Übersicht und Ansicht. */
export function useReportActions(onChanged?: () => void | Promise<void>) {
  const router = useRouter();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<WorkReport | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const createPdf = async (report: WorkReport) => {
    setPdfBusyId(report.id);
    try {
      const name = await downloadReportPdf(report);
      toast(`PDF erstellt: ${name}`, "success");
    } catch (error) {
      console.error(error);
      toast("Das PDF konnte nicht erstellt werden.", "error");
    } finally {
      setPdfBusyId(null);
    }
  };

  const duplicate = async (report: WorkReport) => {
    const copy = await getReportRepository().save(duplicateReport(report));
    toast("Bericht dupliziert – Kopie wird geöffnet", "success");
    router.push(`/bericht?id=${copy.id}`);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await getReportRepository().delete(toDelete.id);
    setToDelete(null);
    toast("Bericht gelöscht");
    await onChanged?.();
  };

  const dialog = (
    <ConfirmDialog
      open={Boolean(toDelete)}
      title="Arbeitsbericht löschen?"
      tone="danger"
      confirmLabel="Endgültig löschen"
      onConfirm={confirmDelete}
      onCancel={() => setToDelete(null)}
    >
      {toDelete && (
        <p>
          „<strong>{reportTitle(toDelete)}</strong>“ wird von diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.
        </p>
      )}
    </ConfirmDialog>
  );

  return { createPdf, duplicate, requestDelete: setToDelete, pdfBusyId, dialog };
}
