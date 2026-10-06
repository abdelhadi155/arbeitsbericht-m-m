import type { SaveState } from "@/hooks/useReportEditor";

import { AlertIcon, CheckIcon } from "../ui/icons";

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-danger" role="status">
        <AlertIcon /> Nicht gespeichert
      </span>
    );
  }
  if (state === "pending" || state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted" role="status">
        <span className="size-2 animate-pulse rounded-full bg-gold" /> Speichert …
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-sm text-success" role="status" data-testid="saved">
        <CheckIcon /> Gespeichert
      </span>
    );
  }
  return <span className="text-sm text-muted">Automatisch gespeichert</span>;
}
