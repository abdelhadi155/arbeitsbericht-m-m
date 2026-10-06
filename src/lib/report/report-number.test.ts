import { describe, expect, it } from "vitest";

import { MemoryReportRepository } from "@/lib/storage/memory-repository";

import { createEmptyReport, duplicateReport, normalizeReport } from "./factory";
import { MemoryReportNumberCounter, formatReportNumber, nextReportNumber, parseReportNumber } from "./report-number";

const newReport = () => createEmptyReport("2026-10-06");

describe("Berichtsnummer", () => {
  it("Format AB-JJJJ-NNNN", () => {
    expect(formatReportNumber(2026, 1)).toBe("AB-2026-0001");
    expect(formatReportNumber(2026, 12345)).toBe("AB-2026-12345");
    expect(parseReportNumber("AB-2026-0042")).toEqual({ year: 2026, sequence: 42 });
    expect(parseReportNumber("XY-1")).toBeNull();
  });

  it("wird beim ersten Speichern vergeben und bleibt danach stabil", async () => {
    const repo = new MemoryReportRepository();
    const first = await repo.save(newReport());
    expect(first.reportNumber).toMatch(/^AB-\d{4}-0001$/);
    const again = await repo.save({ ...first, bauvorhaben: "geändert" });
    expect(again.reportNumber).toBe(first.reportNumber);
    expect((await repo.get(first.id))?.reportNumber).toBe(first.reportNumber);
  });

  it("fortlaufend; Duplikat bekommt eine neue Nummer", async () => {
    const repo = new MemoryReportRepository();
    const a = await repo.save(newReport());
    const b = await repo.save(newReport());
    const copy = await repo.save(duplicateReport(b));
    expect([a, b, copy].map((r) => r.reportNumber?.slice(-4))).toEqual(["0001", "0002", "0003"]);
    expect(copy.id).not.toBe(b.id);
  });

  it("gelöschte Nummern werden nicht erneut vergeben", async () => {
    const repo = new MemoryReportRepository();
    await repo.save(newReport());
    const last = await repo.save(newReport());
    await repo.delete(last.id);
    const next = await repo.save(newReport());
    expect(next.reportNumber?.slice(-4)).toBe("0003");
  });

  it("berücksichtigt importierte Berichte mit höheren Nummern", () => {
    const year = new Date().getFullYear();
    const imported = { ...newReport(), reportNumber: formatReportNumber(year, 41) };
    expect(nextReportNumber(year, [imported], new MemoryReportNumberCounter())).toBe(formatReportNumber(year, 42));
  });

  it("übernimmt das alte Feld „number“ aus Version 1", () => {
    const legacy = { ...newReport(), number: "AB-2026-0007" } as ReturnType<typeof newReport> & { number: string };
    delete (legacy as { reportNumber?: string }).reportNumber;
    const normalized = normalizeReport(legacy);
    expect(normalized.reportNumber).toBe("AB-2026-0007");
    expect("number" in normalized).toBe(false);
  });
});
