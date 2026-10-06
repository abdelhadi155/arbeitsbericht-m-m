import type { Signature, SignatureStroke } from "./types";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function hasStrokes(sig: Signature | null | undefined): sig is Signature & { strokes: SignatureStroke[] } {
  return Boolean(sig?.strokes && sig.strokes.some((s) => s.length >= 2));
}

/** Umgebendes Rechteck aller Striche (im Koordinatensystem der Signatur). */
export function strokesBounds(strokes: SignatureStroke[]): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (let i = 0; i + 1 < stroke.length; i += 2) {
      minX = Math.min(minX, stroke[i]);
      maxX = Math.max(maxX, stroke[i]);
      minY = Math.min(minY, stroke[i + 1]);
      maxY = Math.max(maxY, stroke[i + 1]);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Einpassen ohne Verzerrung: gleiche Skalierung in x und y, zentriert.
 * `maxScale` verhindert, dass ein winziges Kürzel riesig aufgeblasen wird.
 */
export function fitContain(source: { width: number; height: number }, target: Box, maxScale = Infinity) {
  const scale = Math.min(target.width / Math.max(source.width, 1e-6), target.height / Math.max(source.height, 1e-6), maxScale);
  return {
    scale,
    offsetX: target.x + (target.width - source.width * scale) / 2,
    offsetY: target.y + (target.height - source.height * scale) / 2,
  };
}

/** Rundet Koordinaten auf 0,1 px – hält die gespeicherten Daten klein. */
export function roundStroke(points: number[]): number[] {
  return points.map((v) => Math.round(v * 10) / 10);
}
