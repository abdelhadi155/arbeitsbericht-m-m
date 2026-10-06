/**
 * Markenfarben – abgeleitet aus Logo und Papierformular (Schwarz/Anthrazit, Gold, Weiß).
 *
 * Einzige Quelle für Farben in TypeScript (PDF, Manifest, Firmenkonfiguration).
 * src/app/globals.css spiegelt dieselben Werte als Tailwind-Tokens; ein Unit-Test
 * (src/config/brand.test.ts) stellt sicher, dass beide übereinstimmen.
 */
export const brandColors = {
  /** Logo-Kreis */
  black: "#000000",
  /** Schrift, Flächen, dunkle Buttons (Anthrazit der Formular-Fußzeile) */
  ink: "#262223",
  /** Gold aus Logo, Überschrift und Fußzeilen-Punkten */
  gold: "#b8995e",
  /** Dunkleres Gold für gut lesbaren Text auf Weiß */
  goldDark: "#8a6d34",
  /** Helle Goldfläche für Hinweise/Badges */
  goldLight: "#f4ede0",
  white: "#ffffff",
} as const;

/** Neutrale Grautöne (keine Markenfarben, aber ebenfalls zentral). */
export const neutralColors = {
  inkSoft: "#4a4547",
  muted: "#6e6a66",
  line: "#e3e1dc",
  /** Kräftigere Linie für Tabellen und Druck */
  rule: "#c9c5bf",
  paper: "#f6f5f2",
} as const;

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
