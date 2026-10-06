"use client";

/* eslint-disable @next/next/no-img-element -- Unterschriften sind lokale Data-URLs */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { companyAddressLines, companyConfig, formatIban } from "@/config/company-config";
import { dayTotal, formatHours, reportTotal, workerTotal } from "@/lib/report/hours";
import { reportPeriod, reportTitle } from "@/lib/report/summary";
import { WEEKDAYS, WEEKDAY_SHORT, type Signature, type WorkReport } from "@/lib/report/types";
import { getReportRepository } from "@/lib/storage";
import { formatDateDe } from "@/lib/util/dates";

import { BrandLogo } from "../layout/BrandLogo";
import { Button, LinkButton } from "../ui/Button";
import { ArrowLeftIcon, CopyIcon, FileDownIcon, PencilIcon, TrashIcon } from "../ui/icons";
import { StatusBadge } from "../ui/StatusBadge";
import { useReportActions } from "./useReportActions";

function Field({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`border-b border-line pb-2 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-[16px] ${value ? "" : "text-muted"}`}>{value || "–"}</p>
    </div>
  );
}

function SignatureBox({ label, name, sig }: { label: string; name: string; sig: Signature | null }) {
  return (
    <div>
      <div className="flex h-24 items-center justify-center border-b-2 border-ink">
        {sig ? <img src={sig.dataUrl} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-muted">nicht unterschrieben</span>}
      </div>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-[15px]">{name || "–"}</p>
    </div>
  );
}

export function ReportView({ id }: { id: string | null }) {
  const router = useRouter();
  const [report, setReport] = useState<WorkReport | null | undefined>(undefined);
  const actions = useReportActions(() => router.push("/"));

  useEffect(() => {
    if (!id) {
      setReport(null);
      return;
    }
    getReportRepository().get(id).then(setReport).catch(() => setReport(null));
  }, [id]);

  if (report === undefined) return <p className="p-8 text-center text-muted">Bericht wird geladen …</p>;
  if (report === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Bericht nicht gefunden</h1>
        <LinkButton href="/" size="lg" className="mt-6">
          Zur Übersicht
        </LinkButton>
      </main>
    );
  }

  const c = companyConfig;

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2 sm:px-6">
          <LinkButton href="/" variant="ghost" icon={<ArrowLeftIcon className="text-xl" />} className="px-2" aria-label="Zur Übersicht">
            <span className="hidden sm:inline">Übersicht</span>
          </LinkButton>
          <p className="min-w-0 flex-1 truncate font-bold">{reportTitle(report)}</p>
          <StatusBadge status={report.status} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 pt-5 sm:px-6">
        <article className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-10">
          <div className="flex items-start justify-between gap-4 border-b-2 border-gold pb-5">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold-dark">{c.name}</p>
              <h1 className="mt-1 text-3xl font-bold">Arbeitsbericht</h1>
              <p className="mt-1 text-sm text-muted">{reportPeriod(report)}</p>
            </div>
            <BrandLogo size={84} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <Field label="Bauvorhaben" value={report.bauvorhaben} className="sm:col-span-4" />
            <Field label="KW" value={report.kw} />
            <Field label="Zeitraum" value={reportPeriod(report)} className="sm:col-span-3" />
            <Field label="Objekt / KSt.-Nr." value={report.objekt} className="sm:col-span-2" />
            <Field label="Art der Arbeiten" value={report.artDerArbeiten} className="sm:col-span-2" />
          </div>

          <h2 className="mt-8 font-bold">Monteure und Arbeitszeiten</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[15px]">
              <thead>
                <tr className="border-b-2 border-ink bg-paper text-sm">
                  <th className="p-2 text-left">Monteur</th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} className="p-2 text-center">{WEEKDAY_SHORT[d]}</th>
                  ))}
                  <th className="p-2 text-right">Summe</th>
                </tr>
              </thead>
              <tbody>
                {report.workers.map((w) => (
                  <tr key={w.id} className="border-b border-line">
                    <td className="p-2">{w.name || "–"}</td>
                    {WEEKDAYS.map((d) => (
                      <td key={d} className="p-2 text-center tabular-nums">{w.hours[d] || "–"}</td>
                    ))}
                    <td className="p-2 text-right font-bold tabular-nums">{formatHours(workerTotal(w))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gold font-bold">
                  <td className="p-2">Gesamtstunden</td>
                  {WEEKDAYS.map((d) => (
                    <td key={d} className="p-2 text-center tabular-nums">{formatHours(dayTotal(report.workers, d))}</td>
                  ))}
                  <td className="p-2 text-right tabular-nums" data-testid="view-total">{formatHours(reportTotal(report))} Std.</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <h2 className="mt-8 font-bold">Arbeitsbericht: Folgende Arbeiten wurden ausgeführt</h2>
          <p className="mt-2 min-h-16 whitespace-pre-wrap leading-relaxed">{report.description || "–"}</p>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            {(["abgeschlossen", "weitere_arbeiten"] as const).map((v) => (
              <span key={v} className={`flex items-center gap-2 ${report.completion === v ? "font-bold" : "text-muted"}`}>
                <span className="flex size-5 items-center justify-center rounded-full border-2 border-gold">
                  {report.completion === v && <span className="size-2.5 rounded-full bg-ink" />}
                </span>
                {v === "abgeschlossen" ? "Arbeiten abgeschlossen" : "Weitere Arbeiten erforderlich"}
              </span>
            ))}
          </div>
          {report.completion === "weitere_arbeiten" && report.followUpNotes && (
            <div className="mt-4 rounded-xl bg-warn-light p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warn">Noch erforderliche Arbeiten / Hinweise</p>
              <p className="mt-1 whitespace-pre-wrap">{report.followUpNotes}</p>
            </div>
          )}

          <div className="mt-8">
            <Field label="Ort / Datum" value={[report.ort, formatDateDe(report.datum)].filter(Boolean).join(", ")} className="max-w-xs" />
          </div>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <SignatureBox label="Unterschrift Monteur" name={report.monteurName} sig={report.monteurSignature} />
            <SignatureBox label="Unterschrift Kunde" name={report.kundeName} sig={report.kundeSignature} />
          </div>

          <footer className="mt-10 grid gap-4 rounded-xl bg-ink p-5 text-[13px] leading-relaxed text-white/80 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-white">{c.name}</p>
              <p>Inhaber: {c.owner}</p>
              {companyAddressLines(c).map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
            <div>
              <p>{c.contact.phone} / {c.contact.mobile}</p>
              <p>Steuer-Nr. {c.tax.taxNumber}</p>
              <p>{c.contact.website}</p>
              <p>{c.contact.email}</p>
            </div>
            <div>
              <p className="font-semibold text-white">Bank {c.bank.name}</p>
              <p>BIC {c.bank.bic}</p>
              <p>IBAN {formatIban(c.bank.iban)}</p>
            </div>
          </footer>
        </article>
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pt-3 backdrop-blur no-print">
        <div className="mx-auto grid max-w-4xl grid-cols-[1fr_1fr_auto_auto] gap-2 px-3 sm:px-6">
          <LinkButton href={`/bericht?id=${report.id}`} variant="secondary" size="lg" icon={<PencilIcon />}>
            Bearbeiten
          </LinkButton>
          <Button size="lg" icon={<FileDownIcon />} onClick={() => actions.createPdf(report)} disabled={actions.pdfBusyId === report.id}>
            PDF
          </Button>
          <Button variant="secondary" size="lg" aria-label="Duplizieren" onClick={() => actions.duplicate(report)} className="px-4">
            <CopyIcon className="text-lg" />
          </Button>
          <Button variant="secondary" size="lg" aria-label="Löschen" onClick={() => actions.requestDelete(report)} className="px-4 text-danger">
            <TrashIcon className="text-lg" />
          </Button>
        </div>
      </div>
      {actions.dialog}
    </div>
  );
}
