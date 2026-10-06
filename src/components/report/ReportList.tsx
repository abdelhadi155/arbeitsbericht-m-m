"use client";

import { useMemo, useState } from "react";

import { useReports } from "@/hooks/useReports";
import { reportTitle, reportWorkerNames } from "@/lib/report/summary";

import { companyConfig } from "@/config/company-config";

import { BrandLogo } from "../layout/BrandLogo";
import { LinkButton } from "../ui/Button";
import { PlusIcon, SearchIcon } from "../ui/icons";
import { BackupPanel } from "./BackupPanel";
import { ReportCard } from "./ReportCard";
import { useReportActions } from "./useReportActions";

export function ReportList() {
  const { reports, error, reload } = useReports();
  const actions = useReportActions(reload);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!reports) return [];
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) =>
      [reportTitle(r), r.reportNumber ?? "", r.objekt, r.kundeName, r.artDerArbeiten, ...reportWorkerNames(r)].join(" ").toLowerCase().includes(q),
    );
  }, [reports, query]);

  return (
    <div className="pb-16">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-8 pt-6 min-[360px]:gap-4 sm:px-6">
          <BrandLogo size={64} className="size-14 ring-2 ring-gold/40 min-[360px]:size-16" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-gold min-[360px]:text-[13px] min-[360px]:tracking-[0.18em]">
              {companyConfig.name}
            </p>
            <h1 className="text-[26px] font-bold min-[360px]:text-3xl">Arbeitsberichte</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-3xl px-4 sm:px-6">
        <LinkButton
          href="/bericht"
          variant="gold"
          size="lg"
          icon={<PlusIcon className="text-xl" />}
          className="w-full text-lg shadow-lg"
        >
          Neuer Arbeitsbericht
        </LinkButton>

        {error && <p className="mt-6 rounded-xl bg-danger-light p-4 text-danger">{error}</p>}

        {reports && reports.length > 4 && (
          <label className="relative mt-6 block">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen: Bauvorhaben, Kunde, Monteur …"
              aria-label="Berichte durchsuchen"
              className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-[16px] focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/20"
            />
          </label>
        )}

        <section className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4" aria-label="Gespeicherte Arbeitsberichte">
          {reports === null && <p className="py-10 text-center text-muted">Wird geladen …</p>}
          {reports?.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-line bg-white px-6 py-12 text-center">
              <p className="text-lg font-semibold">Noch keine Arbeitsberichte</p>
              <p className="mt-1 text-muted">Tippe auf „Neuer Arbeitsbericht“, um den ersten Bericht anzulegen.</p>
            </div>
          )}
          {reports && reports.length > 0 && filtered.length === 0 && (
            <p className="py-6 text-center text-muted">Keine Treffer für „{query}“.</p>
          )}
          {filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              pdfBusy={actions.pdfBusyId === report.id}
              onPdf={() => actions.createPdf(report)}
              onDuplicate={() => actions.duplicate(report)}
              onDelete={() => actions.requestDelete(report)}
            />
          ))}
        </section>

        {reports && <BackupPanel reports={reports} onImported={reload} />}
      </main>
      {actions.dialog}
    </div>
  );
}
