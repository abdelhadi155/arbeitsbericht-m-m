import type { SaveState } from "@/hooks/useReportEditor";

import { AlertIcon, CheckIcon } from "../ui/icons";

/** Dezenter, immer einzeiliger Speicherstatus (feste Höhe – die Kopfzeile springt nie). */
export function SaveIndicator({ state }: { state: SaveState }) {
  const base = "flex h-5 min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-sm";
  if (state === "error") {
    return (
      <span className={`${base} font-medium text-danger`} role="status">
        <AlertIcon className="shrink-0" /> <span className="truncate">Nicht gespeichert</span>
      </span>
    );
  }
  if (state === "pending" || state === "saving") {
    return (
      <span className={`${base} text-muted`} role="status">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-gold" /> <span className="truncate">Speichert …</span>
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className={`${base} text-success`} role="status" data-testid="saved">
        <CheckIcon className="shrink-0" /> <span className="truncate">Gespeichert</span>
      </span>
    );
  }
  return (
    <span className={`${base} text-muted`}>
      <span className="truncate">Speichert automatisch</span>
    </span>
  );
}
