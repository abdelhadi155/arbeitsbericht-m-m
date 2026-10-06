import { describe, expect, it } from "vitest";

import { fitContain, hasStrokes, roundStroke, strokesBounds } from "./signature";

describe("Unterschrift", () => {
  it("passt ohne Verzerrung ein (gleiche Skalierung x/y, zentriert)", () => {
    const fit = fitContain({ width: 340, height: 176 }, { x: 0, y: 0, width: 80, height: 21 });
    expect(fit.scale).toBeCloseTo(21 / 176);
    expect(fit.offsetY).toBeCloseTo(0);
    expect(fit.offsetX).toBeCloseTo((80 - 340 * fit.scale) / 2);
  });
  it("berechnet die Ausdehnung der Striche", () => {
    expect(strokesBounds([[10, 20, 30, 5], [15, 40]])).toEqual({ x: 10, y: 5, width: 20, height: 35 });
    expect(strokesBounds([])).toBeNull();
  });
  it("rundet Koordinaten und erkennt leere Unterschriften", () => {
    expect(roundStroke([1.234, 5.678])).toEqual([1.2, 5.7]);
    expect(hasStrokes({ dataUrl: "", width: 1, height: 1, signedAt: "", strokes: [] })).toBe(false);
    expect(hasStrokes(null)).toBe(false);
  });
});
