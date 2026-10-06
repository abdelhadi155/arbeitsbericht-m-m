"use client";

import { useEffect, useRef, useState } from "react";

import { reportTitle } from "@/lib/report/summary";
import type { WorkReport } from "@/lib/report/types";
import { getReportRepository } from "@/lib/storage";
import {
  backupFileName,
  createBackup,
  parseBackup,
  planImport,
  reportsToWrite,
  serializeBackup,
  type ConflictMode,
  type ImportPlan,
} from "@/lib/storage/backup";
import { formatDateTimeDe } from "@/lib/util/dates";

import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DownloadIcon, UploadIcon } from "../ui/icons";
import { useToast } from "../ui/Toast";

const LAST_EXPORT_KEY = "mm-arbeitsbericht-letzte-sicherung";

function readLastExport(): string | null {
  try {
    return localStorage.getItem(LAST_EXPORT_KEY);
  } catch {
    return null;
  }
}

interface Props {
  reports: WorkReport[];
  onImported: () => void | Promise<void>;
}

/** „Daten sichern“ / „Sicherung importieren“ – solange es noch keine zentrale Datenbank gibt. */
export function BackupPanel({ reports, onImported }: Props) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [pending, setPending] = useState<{ plan: ImportPlan; fileName: string; exportedAt: string } | null>(null);
  const [mode, setMode] = useState<ConflictMode>("keep");
  const [busy, setBusy] = useState(false);

  useEffect(() => setLastExport(readLastExport()), []);

  const exportBackup = () => {
    const now = new Date();
    const blob = new Blob([serializeBackup(createBackup(reports, now))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(now);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    try {
      localStorage.setItem(LAST_EXPORT_KEY, now.toISOString());
    } catch {
      // ignorieren
    }
    setLastExport(now.toISOString());
    toast(`${reports.length} ${reports.length === 1 ? "Bericht" : "Berichte"} gesichert`, "success");
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      toast(`Import abgelehnt: ${result.error}`, "error");
      return;
    }
    const existing = await getReportRepository().list();
    setMode("keep");
    setPending({ plan: planImport(existing, result.backup.reports), fileName: file.name, exportedAt: result.backup.exportedAt });
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const repository = getReportRepository();
      const toWrite = reportsToWrite(pending.plan, mode);
      for (const report of toWrite) await repository.save(report);
      setPending(null);
      toast(toWrite.length ? `${toWrite.length} ${toWrite.length === 1 ? "Bericht" : "Berichte"} importiert` : "Nichts zu importieren – alles bereits vorhanden", "success");
      await onImported();
    } catch (error) {
      console.error(error);
      toast("Der Import ist fehlgeschlagen. Es wurden keine Daten gelöscht.", "error");
    } finally {
      setBusy(false);
    }
  };

  const plan = pending?.plan;
  const willWrite = plan ? reportsToWrite(plan, mode).length : 0;

  return (
    <section aria-labelledby="backup-title" className="mt-10 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 id="backup-title" className="text-base font-bold">
        Datensicherung
      </h2>
      <p className="mt-1 text-sm text-muted">
        Die Berichte liegen nur auf diesem Gerät. Bitte regelmäßig sichern und die Datei z. B. per E-Mail oder in der Cloud ablegen.
        {lastExport ? ` Letzte Sicherung: ${formatDateTimeDe(lastExport)}.` : " Noch keine Sicherung erstellt."}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" size="lg" icon={<DownloadIcon />} onClick={exportBackup} disabled={reports.length === 0}>
          Daten sichern
        </Button>
        <Button variant="secondary" size="lg" icon={<UploadIcon />} onClick={() => fileInput.current?.click()}>
          Sicherung importieren
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Sicherungsdatei auswählen"
          data-testid="backup-file-input"
          onChange={onFile}
        />
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Sicherung importieren?"
        confirmLabel={busy ? "Importiert …" : willWrite ? `${willWrite} ${willWrite === 1 ? "Bericht" : "Berichte"} importieren` : "Schließen"}
        onConfirm={willWrite ? confirmImport : () => setPending(null)}
        onCancel={() => setPending(null)}
      >
        {plan && pending && (
          <div className="grid gap-3" data-testid="import-summary">
            <p>
              Datei: <strong className="break-all">{pending.fileName}</strong>
              {pending.exportedAt && <> (erstellt {formatDateTimeDe(pending.exportedAt)})</>}
            </p>
            <ul className="grid gap-1">
              <li>
                <strong>{plan.toAdd.length}</strong> {plan.toAdd.length === 1 ? "neuer Bericht" : "neue Berichte"}
              </li>
              {plan.unchanged > 0 && <li>{plan.unchanged} bereits identisch vorhanden (werden übersprungen)</li>}
              {plan.conflicts.length > 0 && (
                <li className="font-semibold text-warn">
                  {plan.conflicts.length} {plan.conflicts.length === 1 ? "Bericht existiert" : "Berichte existieren"} bereits mit anderem Inhalt
                </li>
              )}
            </ul>
            {plan.conflicts.length > 0 && (
              <fieldset className="grid gap-2 rounded-xl bg-warn-light p-3">
                <legend className="sr-only">Umgang mit vorhandenen Berichten</legend>
                <p className="text-sm">
                  Betroffen: {plan.conflicts.slice(0, 3).map((c) => reportTitle(c.existing)).join(", ")}
                  {plan.conflicts.length > 3 ? " …" : ""}
                </p>
                {(
                  [
                    ["keep", "Vorhandene behalten (empfohlen)"],
                    ["replace", "Vorhandene durch die Sicherung ersetzen"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
                    <input
                      type="radio"
                      name="conflict-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                      className="size-5 accent-[var(--color-ink)]"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            <p className="text-sm text-muted">Es werden keine Berichte gelöscht.</p>
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}
