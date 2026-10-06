import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { brandColors, neutralColors } from "./brand";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
const token = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1]?.toLowerCase();
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("Markenfarben", () => {
  it("globals.css spiegelt brand.ts", () => {
    for (const [name, value] of Object.entries({ ...brandColors, ...neutralColors })) {
      expect(token(kebab(name)), name).toBe(value);
    }
  });
});
