import { describe, expect, it } from "vitest";

import { isoWeekFromIsoDay, workWeekRange } from "@/lib/util/dates";

import { createEmptyReport, createWorker, duplicateReport } from "./factory";
import { reportPdfFileName, sanitizeFilePart } from "./filename";
import { formatHours, isValidHours, parseHours, reportTotal, sanitizeHoursInput, workerTotal } from "./hours";
import { deriveStatus } from "./status";
import type { Signature, WorkReport } from "./types";
import { validateReport } from "./validation";

const sig: Signature = { dataUrl: "data:image/png;base64,AAAA", width: 300, height: 100, signedAt: "2026-10-06T10:00:00Z" };

function completeReport(): WorkReport {
  const r = createEmptyReport("2026-10-06");
  r.bauvorhaben = "Müller, Badsanierung";
  r.workers = [{ ...createWorker("Ali"), hours: { mo: "8", di: "7,5", mi: "", do: "4", fr: "", sa: "" } }];
  r.description = "Pumpe getauscht.";
  r.completion = "abgeschlossen";
  return r;
}

describe("Stunden", () => {
  it("parst deutsche Dezimalzahlen", () => {
    expect(parseHours("7,5")).toBe(7.5);
    expect(parseHours("7.5")).toBe(7.5);
    expect(parseHours("")).toBe(0);
    expect(Number.isNaN(parseHours("abc"))).toBe(true);
  });
  it("prüft den Bereich 0–24", () => {
    expect(isValidHours("24")).toBe(true);
    expect(isValidHours("25")).toBe(false);
  });
  it("bereinigt Eingaben", () => {
    expect(sanitizeHoursInput("7.5")).toBe("7,5");
    expect(sanitizeHoursInput("8h")).toBe("8");
    expect(sanitizeHoursInput("7,555")).toBe("7,55");
  });
  it("summiert pro Monteur und gesamt", () => {
    const r = completeReport();
    r.workers.push({ ...createWorker("Ben"), hours: { mo: "8", di: "8", mi: "8", do: "8", fr: "6,5", sa: "" } });
    expect(workerTotal(r.workers[0])).toBe(19.5);
    expect(reportTotal(r)).toBe(58);
    expect(formatHours(19.5)).toBe("19,5");
  });
});

describe("Kalenderwoche", () => {
  it("berechnet ISO-KW", () => {
    expect(isoWeekFromIsoDay("2026-10-06")).toBe(41);
    expect(isoWeekFromIsoDay("2021-01-03")).toBe(53);
    expect(isoWeekFromIsoDay("2026-01-01")).toBe(1);
  });
  it("liefert Montag bis Samstag", () => {
    expect(workWeekRange("2026-10-08")).toEqual({ from: "2026-10-05", to: "2026-10-10" });
  });
});

describe("Validierung und Status", () => {
  it("leerer Bericht ist Entwurf mit markierten Feldern", () => {
    const r = createEmptyReport("2026-10-06");
    const fields = validateReport(r).map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["bauvorhaben", "workers", "description", "completion"]));
    expect(deriveStatus(r)).toBe("entwurf");
  });
  it("vollständig → Fertig, mit beiden Unterschriften → Unterschrieben", () => {
    const r = completeReport();
    expect(validateReport(r)).toEqual([]);
    expect(deriveStatus(r)).toBe("fertig");
    r.monteurName = "Ali";
    r.monteurSignature = sig;
    expect(deriveStatus(r)).toBe("fertig");
    r.kundeName = "Frau Müller";
    r.kundeSignature = sig;
    expect(deriveStatus(r)).toBe("unterschrieben");
  });
  it("ungültige Stunden verhindern „Fertig“", () => {
    const r = completeReport();
    r.workers[0].hours.mo = "30";
    expect(deriveStatus(r)).toBe("entwurf");
  });
});

describe("Duplizieren", () => {
  it("übernimmt Inhalt, aber keine Unterschriften", () => {
    const r = { ...completeReport(), monteurSignature: sig, kundeSignature: sig };
    const copy = duplicateReport(r);
    expect(copy.id).not.toBe(r.id);
    expect(copy.bauvorhaben).toBe(r.bauvorhaben);
    expect(copy.monteurSignature).toBeNull();
    expect(copy.workers[0].id).not.toBe(r.workers[0].id);
  });
});

describe("Dateiname", () => {
  it("ersetzt Umlaute und Sonderzeichen", () => {
    expect(sanitizeFilePart("Müller & Söhne GmbH / Haus 3")).toBe("Mueller_Soehne_GmbH_Haus_3");
    expect(sanitizeFilePart("  Café Größe!  ")).toBe("Cafe_Groesse");
  });
  it("baut Arbeitsbericht_Datum_Kunde.pdf", () => {
    const r = completeReport();
    r.kundeName = "Jörg Weiß";
    expect(reportPdfFileName(r)).toBe("Arbeitsbericht_2026-10-06_Joerg_Weiss.pdf");
    r.kundeName = "";
    expect(reportPdfFileName(r)).toBe("Arbeitsbericht_2026-10-06_Mueller_Badsanierung.pdf");
  });
});
