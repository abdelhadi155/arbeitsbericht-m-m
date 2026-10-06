/**
 * Datenmodell eines Arbeitsberichts.
 *
 * Bewusst flach und serialisierbar (JSON), damit es 1:1 in IndexedDB, in einer
 * Supabase-/PostgreSQL-Tabelle (z. B. als jsonb) oder per API übertragen werden kann.
 */

export const WEEKDAYS = ["mo", "di", "mi", "do", "fr", "sa"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mo: "Montag",
  di: "Dienstag",
  mi: "Mittwoch",
  do: "Donnerstag",
  fr: "Freitag",
  sa: "Samstag",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mo: "Mo",
  di: "Di",
  mi: "Mi",
  do: "Do",
  fr: "Fr",
  sa: "Sa",
};

/** Eine Zeile der Tabelle „Monteure“. Stunden bleiben Text („7,5“), damit die Eingabe nicht springt. */
export interface WorkerEntry {
  id: string;
  name: string;
  hours: Record<Weekday, string>;
  /** Später: Verknüpfung mit einem Benutzerkonto (Login für Monteure). */
  userId?: string;
}

export type CompletionStatus = "abgeschlossen" | "weitere_arbeiten";

export interface Signature {
  /** PNG als Data-URL (transparenter Hintergrund). */
  dataUrl: string;
  width: number;
  height: number;
  signedAt: string;
}

/** Automatisch bestimmter Bearbeitungsstand. */
export type ReportStatus = "entwurf" | "fertig" | "unterschrieben";

export interface WorkReport {
  id: string;
  /** Laufende Berichtsnummer – wird später zentral vergeben (z. B. „AB-2026-0042“). */
  number?: string;
  createdAt: string;
  updatedAt: string;

  bauvorhaben: string;
  /** Kalenderwoche – wird aus „von“ berechnet, kann aber überschrieben werden. */
  kw: string;
  dateFrom: string; // ISO yyyy-mm-dd
  dateTo: string; // ISO yyyy-mm-dd
  objekt: string;
  artDerArbeiten: string;

  workers: WorkerEntry[];

  description: string;

  completion: CompletionStatus | null;
  followUpNotes: string;

  ort: string;
  datum: string; // ISO yyyy-mm-dd
  monteurName: string;
  monteurSignature: Signature | null;
  kundeName: string;
  kundeSignature: Signature | null;

  /** Wird beim Speichern aus den Inhalten abgeleitet (siehe status.ts). */
  status: ReportStatus;

  // --- Vorbereitete Erweiterungen (noch ohne Oberfläche) ---
  /** Verweis auf Kundenstamm (Kundenverwaltung). */
  customerId?: string;
  /** Verweis auf Baustellenverwaltung. */
  siteId?: string;
  /** Fotos zur Baustelle (z. B. Storage-Pfade). */
  photos?: { id: string; url: string; caption?: string }[];
  /** Materialverbrauch. */
  materials?: { id: string; name: string; quantity: string; unit: string }[];
  /** Für Offline-Synchronisierung: Stand der letzten erfolgreichen Synchronisierung. */
  syncedAt?: string;
}
