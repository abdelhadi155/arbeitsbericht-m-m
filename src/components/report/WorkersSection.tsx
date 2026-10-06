"use client";

import { createWorker } from "@/lib/report/factory";
import { formatHours, isValidHours, reportTotal, sanitizeHoursInput, workerTotal, dayTotal } from "@/lib/report/hours";
import { WEEKDAYS, WEEKDAY_LABELS, WEEKDAY_SHORT, type Weekday, type WorkReport, type WorkerEntry } from "@/lib/report/types";
import type { ValidationField } from "@/lib/report/validation";

import { Button } from "../ui/Button";
import { fieldInputClass } from "../ui/Field";
import { AlertIcon, PlusIcon, TrashIcon } from "../ui/icons";
import { SectionCard } from "./SectionCard";

interface Props {
  report: WorkReport;
  update: (updater: (current: WorkReport) => WorkReport) => void;
  errors: Partial<Record<ValidationField, string>>;
  knownNames: string[];
}

const hourInputClass = (value: string) =>
  `h-12 w-full rounded-lg border text-center text-[17px] tabular-nums focus:outline-none focus:ring-4 ${
    isValidHours(value) ? "border-line bg-white focus:border-gold focus:ring-gold/20" : "border-danger bg-danger-light focus:ring-danger/15"
  }`;

export function WorkersSection({ report, update, errors, knownNames }: Props) {
  const setWorker = (id: string, change: (w: WorkerEntry) => WorkerEntry) =>
    update((r) => ({ ...r, workers: r.workers.map((w) => (w.id === id ? change(w) : w)) }));

  const setName = (id: string, name: string) => setWorker(id, (w) => ({ ...w, name }));
  const setHours = (id: string, day: Weekday, value: string) =>
    setWorker(id, (w) => ({ ...w, hours: { ...w.hours, [day]: sanitizeHoursInput(value) } }));
  const fillWeek = (id: string) =>
    setWorker(id, (w) => ({ ...w, hours: { ...w.hours, mo: "8", di: "8", mi: "8", do: "8", fr: "8" } }));
  const addWorker = () => update((r) => ({ ...r, workers: [...r.workers, createWorker()] }));
  const removeWorker = (id: string) => update((r) => ({ ...r, workers: r.workers.filter((w) => w.id !== id) }));

  const total = reportTotal(report);
  const errorText = errors.workers ?? errors.hours;

  return (
    <SectionCard
      id="monteure"
      step={2}
      title="Monteure & Arbeitszeiten"
      description="Stunden pro Tag eintragen, z. B. 8 oder 7,5"
    >
      <datalist id="known-workers">
        {knownNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {errorText && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-danger-light px-3 py-2 text-sm font-medium text-danger" data-field-error="true">
          <AlertIcon className="shrink-0" /> {errorText}
        </p>
      )}

      {/* Smartphone: eine Karte pro Monteur */}
      <div className="grid gap-4 md:hidden">
        {report.workers.map((worker, index) => (
          <div key={worker.id} className="rounded-xl border border-line bg-paper/60 p-3" data-testid="worker-card">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-sm font-semibold">Monteur {index + 1}</span>
                <input
                  value={worker.name}
                  onChange={(e) => setName(worker.id, e.target.value)}
                  list="known-workers"
                  placeholder="Name"
                  autoComplete="off"
                  aria-label={`Name Monteur ${index + 1}`}
                  className={fieldInputClass(index === 0 ? errors.workers : undefined, "h-12")}
                />
              </label>
              <Button
                variant="ghost"
                aria-label={`Monteur ${index + 1} entfernen`}
                onClick={() => removeWorker(worker.id)}
                className="h-12 w-12 px-0 text-danger"
              >
                <TrashIcon className="text-xl" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {WEEKDAYS.map((day) => (
                <label key={day} className="block">
                  <span className="mb-1 block text-center text-xs font-semibold uppercase tracking-wide text-muted">
                    {WEEKDAY_SHORT[day]}
                  </span>
                  <input
                    inputMode="decimal"
                    value={worker.hours[day]}
                    onChange={(e) => setHours(worker.id, day, e.target.value)}
                    aria-label={`${WEEKDAY_LABELS[day]} Stunden Monteur ${index + 1}`}
                    placeholder="–"
                    className={hourInputClass(worker.hours[day])}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => fillWeek(worker.id)} className="px-2 text-sm text-gold-dark">
                Mo–Fr je 8 Std.
              </Button>
              <p className="text-[15px]">
                Summe: <strong className="tabular-nums">{formatHours(workerTotal(worker))} Std.</strong>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tablet/Desktop: Tabelle wie auf dem Papierformular */}
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b-2 border-ink text-left text-sm">
              <th className="w-[30%] pb-2 font-semibold">Monteur</th>
              {WEEKDAYS.map((day) => (
                <th key={day} className="pb-2 text-center font-semibold">
                  <span className="lg:hidden">{WEEKDAY_SHORT[day]}</span>
                  <span className="hidden lg:inline">{WEEKDAY_LABELS[day]}</span>
                </th>
              ))}
              <th className="w-20 pb-2 text-right font-semibold">Summe</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {report.workers.map((worker, index) => (
              <tr key={worker.id} className="border-b border-line" data-testid="worker-row">
                <td className="py-2 pr-2">
                  <input
                    value={worker.name}
                    onChange={(e) => setName(worker.id, e.target.value)}
                    list="known-workers"
                    placeholder={`Monteur ${index + 1}`}
                    autoComplete="off"
                    aria-label={`Name Monteur ${index + 1}`}
                    className={fieldInputClass(index === 0 ? errors.workers : undefined, "h-12")}
                  />
                </td>
                {WEEKDAYS.map((day) => (
                  <td key={day} className="px-1 py-2">
                    <input
                      inputMode="decimal"
                      value={worker.hours[day]}
                      onChange={(e) => setHours(worker.id, day, e.target.value)}
                      aria-label={`${WEEKDAY_LABELS[day]} Stunden Monteur ${index + 1}`}
                      placeholder="–"
                      className={hourInputClass(worker.hours[day])}
                    />
                  </td>
                ))}
                <td className="py-2 text-right text-[17px] font-bold tabular-nums">{formatHours(workerTotal(worker))}</td>
                <td className="py-2 text-right">
                  <Button
                    variant="ghost"
                    aria-label={`Monteur ${index + 1} entfernen`}
                    onClick={() => removeWorker(worker.id)}
                    className="h-11 w-11 px-0 text-danger"
                  >
                    <TrashIcon className="text-lg" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gold text-sm text-muted">
              <td className="pt-2 font-semibold">Summe pro Tag</td>
              {WEEKDAYS.map((day) => (
                <td key={day} className="pt-2 text-center tabular-nums">
                  {formatHours(dayTotal(report.workers, day))}
                </td>
              ))}
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" size="lg" icon={<PlusIcon />} onClick={addWorker}>
          Monteur hinzufügen
        </Button>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-ink px-5 py-3 text-white sm:justify-end">
          <span className="text-[15px] text-white/80">Gesamtstunden</span>
          <strong className="text-2xl tabular-nums text-gold" data-testid="total-hours">
            {formatHours(total)} Std.
          </strong>
        </div>
      </div>
    </SectionCard>
  );
}
