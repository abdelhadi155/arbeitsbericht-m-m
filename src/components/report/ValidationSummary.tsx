import type { ValidationIssue } from "@/lib/report/validation";

import { AlertIcon, CheckIcon } from "../ui/icons";

const TARGET: Record<ValidationIssue["field"], string> = {
  bauvorhaben: "bauvorhaben",
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  workers: "monteure",
  hours: "monteure",
  description: "description",
  completion: "arbeiten",
  followUpNotes: "followUpNotes",
};

export function ValidationSummary({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success-light p-4 text-success" role="status">
        <CheckIcon className="text-xl" />
        <p className="font-semibold">Alle Pflichtangaben sind vorhanden.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger-light p-4" role="alert" data-testid="validation-summary">
      <p className="flex items-center gap-2 font-bold text-danger">
        <AlertIcon className="text-xl" /> Bitte noch ergänzen ({issues.length})
      </p>
      <ul className="mt-2 grid gap-1 pl-7">
        {issues.map((issue) => (
          <li key={issue.field}>
            <a
              href={`#${TARGET[issue.field]}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(TARGET[issue.field]);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
              }}
              className="text-[15px] font-medium text-danger underline underline-offset-2"
            >
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 pl-7 text-sm text-ink-soft">Der Bericht ist als Entwurf gespeichert.</p>
    </div>
  );
}
