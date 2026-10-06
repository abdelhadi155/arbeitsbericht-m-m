"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { formatHours, reportTotal } from "@/lib/report/hours";
import { reportPeriod, reportTitle, reportWorkerNames } from "@/lib/report/summary";
import type { WorkReport } from "@/lib/report/types";

import { CopyIcon, EyeIcon, FileDownIcon, PencilIcon, TrashIcon, ClockIcon, UserIcon } from "../ui/icons";
import { StatusBadge } from "../ui/StatusBadge";

interface Props {
  report: WorkReport;
  onPdf: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  pdfBusy: boolean;
}

function Action({ label, icon, onClick, href, tone = "default", disabled }: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger" | "primary";
  disabled?: boolean;
}) {
  const cls = `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[12px] font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:text-sm ${
    tone === "danger" ? "text-danger hover:bg-danger-light" : tone === "primary" ? "text-ink hover:bg-gold-light" : "text-ink-soft hover:bg-paper"
  } disabled:opacity-50`;
  const content = (
    <>
      <span className="text-lg">{icon}</span>
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

export function ReportCard({ report, onPdf, onDuplicate, onDelete, pdfBusy }: Props) {
  const workers = reportWorkerNames(report);
  const customer = report.kundeName.trim();
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm" data-testid="report-card">
      <Link href={`/ansicht?id=${report.id}`} className="block p-4 hover:bg-paper/50 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted">{reportPeriod(report)}{report.kw ? ` · KW ${report.kw}` : ""}</p>
          <StatusBadge status={report.status} />
        </div>
        <h2 className="mt-1 text-lg font-bold leading-snug">{reportTitle(report)}</h2>
        {(customer || report.objekt) && (
          <p className="mt-0.5 text-[15px] text-ink-soft">
            {[customer && customer !== report.bauvorhaben ? `Kunde: ${customer}` : null, report.objekt ? `Objekt: ${report.objekt}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <UserIcon className="text-muted" />
            {workers.length ? workers.join(", ") : "Kein Monteur"}
          </span>
          <span className="flex items-center gap-1.5">
            <ClockIcon className="text-muted" />
            <strong className="tabular-nums text-ink">{formatHours(reportTotal(report))} Std.</strong>
          </span>
        </div>
      </Link>
      <div className="grid grid-cols-5 border-t border-line px-1 py-1">
        <Action label="Öffnen" icon={<EyeIcon />} href={`/ansicht?id=${report.id}`} tone="primary" />
        <Action label="Bearbeiten" icon={<PencilIcon />} href={`/bericht?id=${report.id}`} />
        <Action label={pdfBusy ? "…" : "PDF"} icon={<FileDownIcon />} onClick={onPdf} disabled={pdfBusy} />
        <Action label="Duplizieren" icon={<CopyIcon />} onClick={onDuplicate} />
        <Action label="Löschen" icon={<TrashIcon />} onClick={onDelete} tone="danger" />
      </div>
    </article>
  );
}
