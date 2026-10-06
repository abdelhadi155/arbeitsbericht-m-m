import { describe, expect, it } from "vitest";

import { formatDateDe, formatDateTimeDe, formatDayMonth, isoWeekFromIsoDay, workWeekDays } from "./dates";

describe("Datumsformate", () => {
  it("TT.MM.JJJJ ohne doppelte Punkte", () => {
    expect(formatDateDe("2026-10-06")).toBe("06.10.2026");
    expect(formatDateDe("2026-01-09")).toBe("09.01.2026");
    expect(formatDateDe("")).toBe("");
    expect(formatDateDe("kein Datum")).toBe("");
  });
  it("Spaltenköpfe TT.MM.", () => {
    const days = workWeekDays("2026-10-08");
    expect(days.map(formatDayMonth)).toEqual(["05.10.", "06.10.", "07.10.", "08.10.", "09.10.", "10.10."]);
    for (const d of days) expect(formatDayMonth(d)).not.toContain("..");
  });
  it("Zeitstempel", () => {
    expect(formatDateTimeDe(new Date(2026, 9, 6, 7, 5).toISOString())).toBe("06.10.2026, 07:05");
  });
  it("KW über den Jahreswechsel", () => {
    expect(isoWeekFromIsoDay("2026-12-31")).toBe(53);
    expect(isoWeekFromIsoDay("2027-01-04")).toBe(1);
    expect(isoWeekFromIsoDay("2025-12-29")).toBe(1);
  });
});
