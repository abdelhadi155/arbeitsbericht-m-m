"use client";

import type { WorkReport } from "@/lib/report/types";

import { FieldShell, TextField, fieldInputClass } from "../ui/Field";
import { SectionCard } from "./SectionCard";
import { SignaturePad } from "./SignaturePad";

interface Props {
  report: WorkReport;
  update: (patch: Partial<WorkReport>) => void;
}

export function SignatureSection({ report, update }: Props) {
  const firstWorker = report.workers.find((w) => w.name.trim())?.name.trim();

  return (
    <SectionCard id="unterschriften" step={4} title="Abschluss & Unterschriften">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="ort"
          label="Ort"
          value={report.ort}
          onChange={(v) => update({ ort: v })}
          placeholder="z. B. Herford"
          autoComplete="address-level2"
        />
        <FieldShell id="datum" label="Datum">
          <input
            id="datum"
            type="date"
            value={report.datum}
            onChange={(e) => update({ datum: e.target.value })}
            className={fieldInputClass(undefined, "h-13")}
          />
        </FieldShell>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <h3 className="border-b border-line pb-2 text-base font-bold">Monteur</h3>
          <TextField
            id="monteurName"
            label="Name Monteur"
            value={report.monteurName}
            onChange={(v) => update({ monteurName: v })}
            list="known-workers"
            autoComplete="off"
            placeholder={firstWorker ?? "Vor- und Nachname"}
            onFocus={() => {
              if (!report.monteurName && firstWorker) update({ monteurName: firstWorker });
            }}
          />
          <SignaturePad
            label="Unterschrift Monteur"
            value={report.monteurSignature}
            onChange={(sig) => update({ monteurSignature: sig })}
          />
        </div>

        <div className="grid content-start gap-4">
          <h3 className="border-b border-line pb-2 text-base font-bold">Kunde</h3>
          <TextField
            id="kundeName"
            label="Name Kunde"
            value={report.kundeName}
            onChange={(v) => update({ kundeName: v })}
            autoComplete="off"
            placeholder="Vor- und Nachname"
          />
          <SignaturePad
            label="Unterschrift Kunde"
            value={report.kundeSignature}
            onChange={(sig) => update({ kundeSignature: sig })}
          />
        </div>
      </div>
    </SectionCard>
  );
}
