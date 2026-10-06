import { describe, expect, it } from "vitest";

import { normalReport, shortReport } from "@/lib/report/fixtures";

import { BACKUP_FORMAT, backupFileName, createBackup, parseBackup, planImport, reportsToWrite, serializeBackup } from "./backup";
import { MemoryReportRepository } from "./memory-repository";

const withId = (id: string, r = normalReport()) => ({ ...r, id });

describe("Datensicherung", () => {
  it("Export enthält alle Berichte inkl. Unterschriften und Nummern", () => {
    const reports = [withId("bericht-0001", shortReport()), withId("bericht-0002")];
    const text = serializeBackup(createBackup(reports, new Date("2026-10-06T12:00:00Z")));
    const data = JSON.parse(text);
    expect(data.format).toBe(BACKUP_FORMAT);
    expect(data.count).toBe(2);
    expect(data.reports[1].reportNumber).toBe("AB-2026-0002");
    expect(data.reports[1].kundeSignature.strokes.length).toBeGreaterThan(0);
    expect(backupFileName(new Date(2026, 9, 6))).toBe("Arbeitsberichte_Sicherung_2026-10-06.json");
  });

  it("Export → Import ergibt dieselben Berichte", async () => {
    const original = [withId("bericht-0001", shortReport()), withId("bericht-0002")];
    const parsed = parseBackup(serializeBackup(createBackup(original)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.reports).toHaveLength(2);
    expect(parsed.backup.reports[1]).toEqual(original[1]);

    const repo = new MemoryReportRepository();
    const plan = planImport(await repo.list(), parsed.backup.reports);
    for (const r of reportsToWrite(plan, "keep")) await repo.save(r);
    const restored = await repo.get("bericht-0002");
    expect(restored?.reportNumber).toBe("AB-2026-0002");
    expect(restored?.description).toBe(original[1].description);
  });

  it("überschreibt vorhandene Berichte nur auf ausdrücklichen Wunsch", () => {
    const existing = [withId("bericht-0001"), withId("bericht-0002")];
    const changed = { ...existing[1], description: "anders" };
    const incoming = [existing[0], changed, withId("bericht-0003")];
    const plan = planImport(existing, incoming);
    expect(plan.unchanged).toBe(1);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.toAdd.map((r) => r.id)).toEqual(["bericht-0003"]);
    expect(reportsToWrite(plan, "keep").map((r) => r.id)).toEqual(["bericht-0003"]);
    expect(reportsToWrite(plan, "replace").map((r) => r.id)).toEqual(["bericht-0003", "bericht-0002"]);
  });

  it.each([
    ["kein JSON", "{kaputt", "keine gültige JSON-Datei"],
    ["fremde Datei", JSON.stringify({ hello: "world" }), "keine Sicherung"],
    ["neuere Version", JSON.stringify({ format: BACKUP_FORMAT, version: 99, reports: [] }), "neueren App-Version"],
    ["Berichte fehlen", JSON.stringify({ format: BACKUP_FORMAT, version: 1 }), "keine Berichte"],
    [
      "Bericht ohne ID",
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, reports: [{ ...normalReport(), id: "" }] }),
      "Bericht 1 ist beschädigt",
    ],
    [
      "ungültige Stunden",
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        reports: [{ ...withId("bericht-0001"), workers: [{ id: "w", name: "A", hours: { mo: 8 } }] }],
      }),
      "Stundenangabe ungültig",
    ],
    [
      "manipulierte Unterschrift",
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        reports: [{ ...withId("bericht-0001"), kundeSignature: { dataUrl: "javascript:alert(1)", width: 1, height: 1 } }],
      }),
      "Unterschrift ungültig",
    ],
    [
      "doppelte ID",
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, reports: [withId("bericht-0001"), withId("bericht-0001")] }),
      "doppelt",
    ],
  ])("lehnt ungültige Sicherung ab: %s", (_name, text, message) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});
