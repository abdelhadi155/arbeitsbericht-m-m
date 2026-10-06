import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { longReport, normalReport, shortReport } from "@/lib/report/fixtures";
import type { WorkReport } from "@/lib/report/types";

import { PDF_LAYOUT, footerColumnsBottom, generateReportPdf, type PdfFontData } from "./generate-report-pdf";

const publicFile = (path: string) => readFileSync(fileURLToPath(new URL(`../../../public/${path}`, import.meta.url)));
const logo = `data:image/png;base64,${publicFile("brand/mm-logo.png").toString("base64")}`;
const fonts: PdfFontData = {
  regular: publicFile("fonts/MMBerichtSans-Regular.ttf").toString("base64"),
  bold: publicFile("fonts/MMBerichtSans-Bold.ttf").toString("base64"),
};
/** Mit PDF_OUT=<ordner> werden die Beispiel-PDFs (kurz/normal/lang) zum Ansehen abgelegt – siehe `npm run pdf:beispiele`. */
const outDir = process.env.PDF_OUT;

/**
 * Standard: wie in der App mit eingebetteter Unicode-Schrift.
 * `readableText`: mit PDF-Standardschrift, deren Text im Rohformat lesbar ist (für Textprüfungen).
 */
async function render(report: WorkReport, name: string, readableText = false) {
  const pdf = await generateReportPdf(report, { logoDataUrl: logo, fonts: readableText ? null : fonts, compress: false });
  const raw = pdf.doc.output();
  if (outDir && name.startsWith("beispiel-")) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${name}.pdf`), Buffer.from(pdf.doc.output("arraybuffer")));
  }
  return { ...pdf, raw };
}

function expectCleanLayout(layout: Awaited<ReturnType<typeof render>>["layout"]) {
  // Inhalt endet auf jeder Seite oberhalb der Fußzeile.
  for (const bottom of layout.contentBottomByPage) {
    expect(bottom).toBeLessThanOrEqual(PDF_LAYOUT.contentBottom);
  }
  // Unterschriftenblock liegt vollständig auf einer Seite.
  expect(layout.signaturesBottom).toBeGreaterThan(layout.signaturesTop);
  expect(layout.signaturesBottom).toBeLessThanOrEqual(PDF_LAYOUT.contentBottom);
}

describe("PDF-Layout", () => {
  it("Seitenzahl-Zeile liegt klar unter den Bankdaten", () => {
    expect(footerColumnsBottom()).toBeLessThan(PDF_LAYOUT.footerDivider);
    expect(PDF_LAYOUT.footerDivider).toBeLessThan(PDF_LAYOUT.footerPageRowBaseline - 2.5);
    expect(PDF_LAYOUT.contentBottom).toBeLessThan(PDF_LAYOUT.footerTop);
  });

  it("kurzer Bericht: eine Seite inklusive Unterschriften", async () => {
    const { layout } = await render(shortReport(), "beispiel-kurz");
    expect(layout.pages).toBe(1);
    expect(layout.signaturesPage).toBe(1);
    expectCleanLayout(layout);
  });

  it("normaler Bericht: eine Seite inklusive Unterschriften", async () => {
    const { layout } = await render(normalReport(), "beispiel-normal");
    expect(layout.pages).toBe(1);
    expect(layout.signaturesPage).toBe(1);
    expectCleanLayout(layout);
  });

  it("sehr langer Bericht: mehrere Seiten, Unterschriften zusammen, Fußzeile auf jeder Seite", async () => {
    const { layout } = await render(longReport(), "beispiel-lang");
    expect(layout.pages).toBeGreaterThan(1);
    expect(layout.signaturesPage).toBe(layout.pages);
    expectCleanLayout(layout);
    const { raw } = await render(longReport(), "test-lang-text", true);
    for (let p = 1; p <= layout.pages; p++) {
      expect(raw).toContain(`(Seite ${p} von ${layout.pages})`);
    }
    expect(raw.match(/\(IBAN DE51 4825 0110 0004 8171 90\)/g)).toHaveLength(layout.pages);
  });

  it("zeigt Berichtsnummer im Kopf und korrekte Datumsformate", async () => {
    const { raw, fileName } = await render(normalReport(), "test-datum", true);
    expect(raw).toContain("(Arbeitsbericht)");
    expect(raw).toContain("(Nr. AB-2026-0002)");
    expect(raw).toContain("(05.10.2026 \u0096 10.10.2026)"); // „–“ als WinAnsi-Zeichen 0x96
    expect(raw).toContain("(05.10.)");
    expect(raw).toContain("(Herford, 06.10.2026)");
    expect(raw).not.toMatch(/\d\.\.\d|\d{2}\.\.\)/);
    expect(fileName).toBe("Arbeitsbericht_2026-10-06_Joerg_Mueller.pdf");
  });

  it("lange Namen werden umbrochen statt abgeschnitten", async () => {
    const { raw } = await render(longReport(), "test-namen", true);
    expect(raw).toContain("(Maximilian-Alexander von)");
    expect(raw).toContain("(Hohenstein-Wittgenstein)");
  });

  it("bettet die Unicode-Schrift ein (für Namen wie Petrović, Şahin, Łukasz)", async () => {
    const r = normalReport();
    r.workers[0].name = "Dragan Petrović";
    r.workers[1].name = "Mehmet Şahin";
    r.kundeName = "Łukasz Wiśniewski";
    const { raw, layout } = await render(r, "test-sonderzeichen");
    // Regular + Bold als eingebettete CID-TrueType-Schrift (Unicode, Identity-H)
    expect(raw.match(/\/FontName \/MMBerichtSans\b/g)).toHaveLength(2);
    expect(raw).toContain("/Encoding /Identity-H");
    expect(layout.pages).toBe(1);
  });
});
