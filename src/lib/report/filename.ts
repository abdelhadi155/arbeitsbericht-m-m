import type { WorkReport } from "./types";

const UMLAUTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "Ae",
  Ö: "Oe",
  Ü: "Ue",
  ß: "ss",
};

/** Macht einen beliebigen Text dateinamentauglich: „Müller & Söhne GmbH“ → „Mueller_Soehne_GmbH“. */
export function sanitizeFilePart(value: string, maxLength = 60): string {
  return value
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, maxLength)
    .replace(/[_-]+$/g, "");
}

/** Arbeitsbericht_2026-10-06_Kundenname.pdf */
export function reportPdfFileName(report: WorkReport): string {
  const date = report.datum || report.dateFrom || report.createdAt.slice(0, 10);
  const who = sanitizeFilePart(report.kundeName || report.bauvorhaben || report.objekt);
  return ["Arbeitsbericht", date, who].filter(Boolean).join("_") + ".pdf";
}
