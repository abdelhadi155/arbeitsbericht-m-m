"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useReportEditor } from "@/hooks/useReportEditor";
import { useKnownWorkerNames } from "@/hooks/useReports";
import { downloadReportPdf } from "@/lib/pdf/generate-report-pdf";
import { issuesByField, validateReport } from "@/lib/report/validation";
import type { WorkReport } from "@/lib/report/types";

import { BrandLogo } from "../layout/BrandLogo";
import { Button, LinkButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ArrowLeftIcon, CheckIcon, FileDownIcon } from "../ui/icons";
import { StatusBadge } from "../ui/StatusBadge";
import { useToast } from "../ui/Toast";
import { ProjectSection } from "./ProjectSection";
import { SaveIndicator } from "./SaveIndicator";
import { SignatureSection } from "./SignatureSection";
import { ValidationSummary } from "./ValidationSummary";
import { WorkDescriptionSection } from "./WorkDescriptionSection";
import { WorkersSection } from "./WorkersSection";

export function ReportEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const { report, notFound, saveState, isPersisted, update, saveNow } = useReportEditor(id);
  const knownNames = useKnownWorkerNames();
  const [showErrors, setShowErrors] = useState(false);
  const [confirmPdf, setConfirmPdf] = useState(false);
  const [busy, setBusy] = useState(false);

  // Neue Berichte bekommen nach dem ersten Speichern eine feste Adresse (Neuladen öffnet denselben Bericht).
  useEffect(() => {
    if (!id && isPersisted && report) {
      window.history.replaceState(window.history.state, "", `/bericht?id=${report.id}`);
    }
  }, [id, isPersisted, report]);

  const issues = useMemo(() => (report ? validateReport(report) : []), [report]);
  const errors = showErrors ? issuesByField(issues) : {};

  if (notFound) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Bericht nicht gefunden</h1>
        <p className="mt-2 text-muted">Der Arbeitsbericht wurde gelöscht oder ist auf diesem Gerät nicht gespeichert.</p>
        <LinkButton href="/" size="lg" className="mt-6">
          Zur Übersicht
        </LinkButton>
      </main>
    );
  }

  if (!report) {
    return <p className="p-8 text-center text-muted">Bericht wird geladen …</p>;
  }

  const patch = (p: Partial<WorkReport>) => update(p);

  const check = () => {
    setShowErrors(true);
    if (issues.length === 0) {
      toast("Alle Pflichtangaben vorhanden ✓", "success");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createPdf = async () => {
    setConfirmPdf(false);
    setBusy(true);
    try {
      await saveNow();
      const fileName = await downloadReportPdf(report);
      toast(`PDF erstellt: ${fileName}`, "success");
    } catch (error) {
      console.error(error);
      toast("Das PDF konnte nicht erstellt werden.", "error");
    } finally {
      setBusy(false);
    }
  };

  const requestPdf = () => {
    if (issues.length > 0) {
      setShowErrors(true);
      setConfirmPdf(true);
    } else {
      void createPdf();
    }
  };

  const back = async () => {
    await saveNow();
    router.push("/");
  };

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:px-6">
          <Button variant="ghost" onClick={back} icon={<ArrowLeftIcon className="text-xl" />} className="px-2" aria-label="Zur Übersicht">
            <span className="hidden sm:inline">Übersicht</span>
          </Button>
          <BrandLogo size={36} className="hidden sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight">{report.bauvorhaben || "Neuer Arbeitsbericht"}</p>
            <SaveIndicator state={saveState} />
          </div>
          <StatusBadge status={report.status} />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-3 pt-5 sm:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold-dark">Arbeitsbericht</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{id ? "Bericht bearbeiten" : "Neuer Arbeitsbericht"}</h1>
          <p className="mt-1 text-[15px] text-muted">
            Felder mit <span className="text-gold-dark">*</span> sind Pflicht. Alles wird automatisch gespeichert.
          </p>
        </div>

        {showErrors && <ValidationSummary issues={issues} />}

        <ProjectSection report={report} update={patch} errors={errors} />
        <WorkersSection report={report} update={update} errors={errors} knownNames={knownNames} />
        <WorkDescriptionSection report={report} update={patch} errors={errors} />
        <SignatureSection report={report} update={patch} />
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pt-3 backdrop-blur no-print">
        <div className="mx-auto flex max-w-5xl gap-2 px-3 sm:px-6">
          <Button variant="secondary" size="lg" onClick={check} icon={<CheckIcon />} className="flex-1 sm:flex-none">
            Prüfen
          </Button>
          <Button size="lg" onClick={requestPdf} disabled={busy} icon={<FileDownIcon className="text-lg" />} className="flex-[2] sm:flex-1">
            {busy ? "PDF wird erstellt …" : (
              <>
                <span className="sm:hidden">PDF erstellen</span>
                <span className="hidden sm:inline">Arbeitsbericht als PDF erstellen</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPdf}
        title="Bericht ist noch unvollständig"
        confirmLabel="Trotzdem PDF erstellen"
        cancelLabel="Angaben ergänzen"
        onConfirm={createPdf}
        onCancel={() => {
          setConfirmPdf(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <p>Es fehlen noch:</p>
        <ul className="mt-1 list-disc pl-5">
          {issues.map((i) => (
            <li key={i.field}>{i.message}</li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
