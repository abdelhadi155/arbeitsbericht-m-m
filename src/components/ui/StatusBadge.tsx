import { STATUS_LABELS } from "@/lib/report/status";
import type { ReportStatus } from "@/lib/report/types";

const styles: Record<ReportStatus, string> = {
  entwurf: "bg-warn-light text-warn ring-warn/20",
  fertig: "bg-gold-light text-gold-dark ring-gold/30",
  unterschrieben: "bg-success-light text-success ring-success/20",
};

const dots: Record<ReportStatus, string> = {
  entwurf: "bg-warn",
  fertig: "bg-gold",
  unterschrieben: "bg-success",
};

export function StatusBadge({ status, className = "" }: { status: ReportStatus; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ring-1 ring-inset ${styles[status]} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${dots[status]}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
