"use client";

import { isoWeekFromIsoDay, workWeekRange } from "@/lib/util/dates";
import type { ValidationField } from "@/lib/report/validation";
import type { WorkReport } from "@/lib/report/types";

import { FieldShell, TextField, fieldInputClass } from "../ui/Field";
import { SectionCard } from "./SectionCard";

interface Props {
  report: WorkReport;
  update: (patch: Partial<WorkReport>) => void;
  errors: Partial<Record<ValidationField, string>>;
}

export function ProjectSection({ report, update, errors }: Props) {
  const onDateFrom = (value: string) => {
    const patch: Partial<WorkReport> = { dateFrom: value };
    const week = isoWeekFromIsoDay(value);
    if (week) patch.kw = String(week);
    // „bis“ automatisch auf Samstag derselben Woche setzen, wenn leer oder davor
    if (value && (!report.dateTo || report.dateTo < value)) {
      patch.dateTo = workWeekRange(value)?.to ?? value;
    }
    update(patch);
  };

  const autoKw = isoWeekFromIsoDay(report.dateFrom);

  return (
    <SectionCard id="baustelle" step={1} title="Baustelle & Zeitraum">
      <div className="grid gap-5">
        <TextField
          id="bauvorhaben"
          label="Bauvorhaben"
          required
          value={report.bauvorhaben}
          onChange={(v) => update({ bauvorhaben: v })}
          error={errors.bauvorhaben}
          placeholder="z. B. Müller, Badsanierung"
          autoComplete="off"
          enterKeyHint="next"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_8rem]">
          <FieldShell id="dateFrom" label="Datum von" required error={errors.dateFrom}>
            <input
              id="dateFrom"
              type="date"
              value={report.dateFrom}
              onChange={(e) => onDateFrom(e.target.value)}
              className={fieldInputClass(errors.dateFrom, "h-13")}
            />
          </FieldShell>
          <FieldShell id="dateTo" label="bis" error={errors.dateTo}>
            <input
              id="dateTo"
              type="date"
              value={report.dateTo}
              min={report.dateFrom || undefined}
              onChange={(e) => update({ dateTo: e.target.value })}
              className={fieldInputClass(errors.dateTo, "h-13")}
            />
          </FieldShell>
          <FieldShell
            id="kw"
            label="KW"
            className="col-span-2 sm:col-span-1"
            hint={autoKw && String(autoKw) === report.kw ? "automatisch" : undefined}
          >
            <input
              id="kw"
              inputMode="numeric"
              value={report.kw}
              onChange={(e) => update({ kw: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              className={fieldInputClass(undefined, "h-13")}
              placeholder="KW"
            />
          </FieldShell>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="objekt"
            label="Objekt / KSt.-Nr."
            value={report.objekt}
            onChange={(v) => update({ objekt: v })}
            placeholder="z. B. Hauptstr. 5 / 2026-118"
            autoComplete="off"
          />
          <TextField
            id="artDerArbeiten"
            label="Art der Arbeiten"
            value={report.artDerArbeiten}
            onChange={(v) => update({ artDerArbeiten: v })}
            placeholder="z. B. Heizungswartung"
            autoComplete="off"
          />
        </div>
      </div>
    </SectionCard>
  );
}
