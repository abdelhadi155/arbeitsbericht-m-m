"use client";

import { useState } from "react";

import { improveWorkDescription } from "@/lib/ai/text-improver";
import type { CompletionStatus, WorkReport } from "@/lib/report/types";
import type { ValidationField } from "@/lib/report/validation";

import { Button } from "../ui/Button";
import { TextAreaField } from "../ui/Field";
import { AlertIcon, CheckIcon, SparklesIcon } from "../ui/icons";
import { SectionCard } from "./SectionCard";

interface Props {
  report: WorkReport;
  update: (patch: Partial<WorkReport>) => void;
  errors: Partial<Record<ValidationField, string>>;
}

const OPTIONS: { value: CompletionStatus; label: string }[] = [
  { value: "abgeschlossen", label: "Arbeiten abgeschlossen" },
  { value: "weitere_arbeiten", label: "Weitere Arbeiten erforderlich" },
];

export function WorkDescriptionSection({ report, update, errors }: Props) {
  const [improving, setImproving] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const improve = async () => {
    setNotice(null);
    setSuggestion(null);
    setImproving(true);
    const result = await improveWorkDescription(report.description);
    setImproving(false);
    if (result.ok) setSuggestion(result.text);
    else setNotice(result.message);
  };

  return (
    <SectionCard id="arbeiten" step={3} title="Ausgeführte Arbeiten">
      <TextAreaField
        id="description"
        label="Arbeitsbericht: Folgende Arbeiten wurden ausgeführt"
        required
        value={report.description}
        onChange={(v) => update({ description: v })}
        error={errors.description}
        rows={8}
        placeholder="Was wurde gemacht? Stichworte reichen, z. B.: Heizungspumpe getauscht, Anlage gefüllt, entlüftet, Funktion geprüft."
        className="[&_textarea]:min-h-52"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          icon={<SparklesIcon className="text-gold-dark" />}
          onClick={improve}
          disabled={improving || !report.description.trim()}
        >
          {improving ? "Wird verbessert …" : "Text verbessern"}
        </Button>
        {notice && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <AlertIcon className="shrink-0 text-warn" /> {notice}
          </p>
        )}
      </div>

      {suggestion && (
        <div className="mt-4 rounded-xl border border-gold/50 bg-gold-light/60 p-4" data-testid="ai-suggestion">
          <p className="mb-2 text-sm font-semibold text-gold-dark">Vorschlag</p>
          <p className="whitespace-pre-wrap text-[16px] leading-relaxed">{suggestion}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              icon={<CheckIcon />}
              onClick={() => {
                update({ description: suggestion });
                setSuggestion(null);
              }}
            >
              Übernehmen
            </Button>
            <Button variant="ghost" onClick={() => setSuggestion(null)}>
              Verwerfen
            </Button>
          </div>
        </div>
      )}

      <fieldset className="mt-8" data-field-error={errors.completion ? "true" : undefined}>
        <legend className="mb-2 text-[15px] font-semibold">
          Status der Arbeiten <span className="text-gold-dark">*</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const checked = report.completion === option.value;
            return (
              <label
                key={option.value}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-[16px] font-semibold transition-colors ${
                  checked
                    ? "border-ink bg-ink text-white"
                    : errors.completion
                      ? "border-danger bg-danger-light/40"
                      : "border-line bg-white hover:border-ink-soft"
                }`}
              >
                <input
                  type="radio"
                  name="completion"
                  value={option.value}
                  checked={checked}
                  onChange={() => update({ completion: option.value })}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    checked ? "border-gold" : "border-gold/70"
                  }`}
                >
                  {checked && <span className="size-3 rounded-full bg-gold" />}
                </span>
                {option.label}
              </label>
            );
          })}
        </div>
        {errors.completion && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-danger">
            <AlertIcon /> {errors.completion}
          </p>
        )}
      </fieldset>

      {report.completion === "weitere_arbeiten" && (
        <TextAreaField
          id="followUpNotes"
          className="mt-5"
          label="Noch erforderliche Arbeiten / Hinweise"
          value={report.followUpNotes}
          onChange={(v) => update({ followUpNotes: v })}
          rows={4}
          placeholder="z. B. Ersatzteil bestellt, Termin für Montage folgt."
        />
      )}
    </SectionCard>
  );
}
