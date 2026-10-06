import type { jsPDF as JsPdf } from "jspdf";

import { brandColors, hexToRgb, neutralColors, type Rgb } from "@/config/brand";
import { companyAddressLines, companyConfig, formatIban, type CompanyConfig } from "@/config/company-config";
import { reportPdfFileName } from "@/lib/report/filename";
import { dayTotal, formatHours, reportTotal, workerTotal } from "@/lib/report/hours";
import { fitContain, hasStrokes, strokesBounds } from "@/lib/report/signature";
import { WEEKDAYS, WEEKDAY_SHORT, type Signature, type WorkReport } from "@/lib/report/types";
import { formatDateDe, formatDateTimeDe, formatDayMonth, workWeekDays } from "@/lib/util/dates";

/*
 * Layout in Millimetern, DIN A4 hochformat.
 * Bewusst konservativ: weiße Fläche, feine Linien, Gold als Akzent wie auf dem Papierformular.
 *
 *   ┌──────────────────────────────┐  0
 *   │ Kopf (Logo, Titel, Nummer)   │
 *   │ Inhalt … bis CONTENT_BOTTOM  │
 *   ├── Goldlinie FOOTER_TOP ──────┤
 *   │ Firma │ Kontakt │ Bank       │  drei Spalten, max. 4 Zeilen
 *   ├── feine Linie ───────────────┤  FOOTER_DIVIDER
 *   │ Bericht-Nr.     Seite x von y│  eigene Zeile – überlappt nie die Bankdaten
 *   └──────────────────────────────┘  297
 */
export const PDF_LAYOUT = {
  pageWidth: 210,
  pageHeight: 297,
  margin: 18,
  contentBottom: 262,
  footerTop: 267,
  footerFontSize: 7,
  footerLineHeight: 3.3,
  footerMaxLines: 4,
  footerFirstBaseline: 271.5,
  footerDivider: 285.5,
  footerPageRowBaseline: 290,
} as const;

const { pageWidth: PAGE_W, margin: MARGIN, contentBottom: CONTENT_BOTTOM } = PDF_LAYOUT;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const PT_TO_MM = 0.3528;

const INK = hexToRgb(brandColors.ink);
const GOLD = hexToRgb(brandColors.gold);
const GOLD_DARK = hexToRgb(brandColors.goldDark);
const MUTED = hexToRgb(neutralColors.muted);
const LINE = hexToRgb(neutralColors.line);
const RULE = hexToRgb(neutralColors.rule);
const SOFT_FILL = hexToRgb(neutralColors.paper);

/** Gesamtzeilen, ab denen ein einzelnes Feld abgekürzt wird (schützt vor Endlos-Feldern). */
const MAX_FIELD_LINES = 8;

export interface PdfLayoutInfo {
  pages: number;
  /** Tiefster beschriebener Punkt des Inhalts je Seite (mm). */
  contentBottomByPage: number[];
  signaturesPage: number;
  signaturesTop: number;
  signaturesBottom: number;
}

/** Eingebettete Unicode-Schrift (Liberation-Sans-Ausschnitt, metrisch wie Helvetica) – kann ć, š, ş, ğ, ı … */
export const PDF_FONT = {
  family: "MMBerichtSans",
  regular: "/fonts/MMBerichtSans-Regular.ttf",
  bold: "/fonts/MMBerichtSans-Bold.ttf",
} as const;

export interface PdfFontData {
  /** TTF-Dateien als Base64 */
  regular: string;
  bold: string;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function loadFonts(): Promise<PdfFontData | null> {
  try {
    const [regular, bold] = await Promise.all(
      [PDF_FONT.regular, PDF_FONT.bold].map(async (src) => {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`${src}: ${response.status}`);
        return toBase64(await response.arrayBuffer());
      }),
    );
    return { regular, bold };
  } catch (error) {
    console.warn("PDF-Schrift nicht geladen – Standardschrift wird verwendet", error);
    return null;
  }
}

function registerFonts(doc: JsPdf, fonts: PdfFontData): string {
  doc.addFileToVFS(`${PDF_FONT.family}-Regular.ttf`, fonts.regular);
  doc.addFont(`${PDF_FONT.family}-Regular.ttf`, PDF_FONT.family, "normal");
  doc.addFileToVFS(`${PDF_FONT.family}-Bold.ttf`, fonts.bold);
  doc.addFont(`${PDF_FONT.family}-Bold.ttf`, PDF_FONT.family, "bold");
  return PDF_FONT.family;
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

class ReportPdfWriter {
  private y: number = MARGIN;
  private readonly contentBottomByPage: number[] = [];
  private signatures = { page: 0, top: 0, bottom: 0 };

  constructor(
    private readonly doc: JsPdf,
    private readonly report: WorkReport,
    private readonly company: CompanyConfig,
    private readonly logo: string | null,
    private readonly fontFamily: string = "helvetica",
  ) {}

  // ---------- Grundbausteine ----------

  private font(size: number, style: "normal" | "bold" = "normal", color: Rgb = INK) {
    this.doc.setFont(this.fontFamily, style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  private hLine(y: number, color: Rgb = LINE, width = 0.2, x1: number = MARGIN, x2: number = PAGE_W - MARGIN) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(width);
    this.doc.line(x1, y, x2, y);
  }

  /** Umbruch auf Breite; sehr lange Wörter werden ebenfalls getrennt. */
  private wrap(text: string, width: number, maxLines = Infinity): string[] {
    const lines = this.doc.splitTextToSize(text.replace(/\r\n?/g, "\n"), width) as string[];
    if (lines.length <= maxLines) return lines;
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = this.ellipsize(`${cut[maxLines - 1]} …`, width);
    return cut;
  }

  /** Kürzt einen einzeiligen Text mit „…“ auf die Breite (aktuelle Schrift). */
  private ellipsize(text: string, width: number): string {
    if (this.doc.getTextWidth(text) <= width) return text;
    let t = text;
    while (t.length > 1 && this.doc.getTextWidth(`${t}…`) > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  /**
   * Schreibt eine Zeile in die Breite: zuerst wird die Schrift leicht verkleinert (höchstens bis `minSize`),
   * reicht das nicht, wird mit „…“ gekürzt.
   */
  private fitText(text: string, x: number, y: number, width: number, size: number, minSize = size, align: "left" | "right" | "center" = "left") {
    let s = size;
    this.doc.setFontSize(s);
    while (s > minSize && this.doc.getTextWidth(text) > width) {
      s -= 0.25;
      this.doc.setFontSize(s);
    }
    this.doc.text(this.ellipsize(text, width), x, y, { align });
  }

  private markContent() {
    const page = this.doc.getCurrentPageInfo().pageNumber;
    this.contentBottomByPage[page - 1] = Math.max(this.contentBottomByPage[page - 1] ?? 0, this.y);
  }

  private newPage() {
    this.markContent();
    this.doc.addPage();
    this.drawContinuationHeader();
  }

  private ensureSpace(height: number) {
    if (this.y + height > CONTENT_BOTTOM) this.newPage();
  }

  private numberLabel(): string | null {
    return this.report.reportNumber ? `Nr. ${this.report.reportNumber}` : null;
  }

  // ---------- Kopf ----------

  private drawFirstHeader() {
    const logoSize = 26;
    const logoX = PAGE_W - MARGIN - logoSize;
    if (this.logo) {
      this.doc.addImage(this.logo, "PNG", logoX, 10, logoSize, logoSize, "firmenlogo", "SLOW");
    }
    const textW = logoX - MARGIN - 6;

    this.font(8, "bold", GOLD_DARK);
    this.doc.text(this.company.name.toUpperCase(), MARGIN, 17, { charSpace: 0.6 });

    this.font(22, "bold", INK);
    this.doc.text("Arbeitsbericht", MARGIN, 27);
    const number = this.numberLabel();
    if (number) {
      const titleW = this.doc.getTextWidth("Arbeitsbericht ");
      this.font(13, "bold", GOLD_DARK);
      this.fitText(number, MARGIN + titleW, 27, textW - titleW, 13, 10);
    }

    this.font(8.5, "normal", MUTED);
    this.doc.text(`Erstellt am ${formatDateTimeDe(this.report.createdAt)}`, MARGIN, 33.5);

    this.hLine(39, GOLD, 0.6);
    this.y = 45;
  }

  private drawContinuationHeader() {
    this.font(7.5, "bold", GOLD_DARK);
    this.doc.text(this.company.name.toUpperCase(), MARGIN, 14, { charSpace: 0.6 });
    this.font(10, "bold", INK);
    const parts = ["Arbeitsbericht", this.numberLabel(), this.report.bauvorhaben ? `– ${this.report.bauvorhaben}` : null];
    const title = parts.filter(Boolean).join(" ");
    const suffix = " (Fortsetzung)";
    const room = CONTENT_W - this.doc.getTextWidth(suffix);
    this.doc.text(`${this.ellipsize(title, room)}${suffix}`, MARGIN, 20);
    this.hLine(23.5, GOLD, 0.4);
    this.y = 29;
  }

  // ---------- Stammdaten ----------

  private fieldLines(value: string, width: number): string[] {
    this.font(10.5);
    return this.wrap(value || "–", width, MAX_FIELD_LINES);
  }

  private drawFieldRow(fields: { label: string; value: string; width: number }[]) {
    const gap = 8;
    const lineH = 10.5 * PT_TO_MM * 1.2;
    const prepared = fields.map((f) => ({ ...f, lines: this.fieldLines(f.value, f.width) }));
    const height = Math.max(...prepared.map((f) => 8.5 + (f.lines.length - 1) * lineH + 2.6));
    this.ensureSpace(height + 3);
    let x = MARGIN;
    for (const f of prepared) {
      this.font(7, "bold", MUTED);
      this.doc.text(f.label.toUpperCase(), x, this.y + 3, { charSpace: 0.3 });
      this.font(10.5, "normal", f.value ? INK : MUTED);
      this.doc.text(f.lines, x, this.y + 8.2, { lineHeightFactor: 1.2 });
      this.hLine(this.y + height, LINE, 0.2, x, x + f.width);
      x += f.width + gap;
    }
    this.y += height + 3;
  }

  private drawMasterData() {
    const r = this.report;
    const period = [formatDateDe(r.dateFrom), formatDateDe(r.dateTo)].filter(Boolean).join(" – ");
    const half = (CONTENT_W - 8) / 2;
    this.drawFieldRow([{ label: "Bauvorhaben", value: r.bauvorhaben, width: CONTENT_W }]);
    this.drawFieldRow([
      { label: "KW", value: r.kw, width: 14 },
      { label: "Zeitraum", value: period, width: half - 22 },
      { label: "Objekt / KSt.-Nr.", value: r.objekt, width: half },
    ]);
    this.drawFieldRow([{ label: "Art der Arbeiten", value: r.artDerArbeiten, width: CONTENT_W }]);
    this.y += 2;
  }

  // ---------- Monteure / Stunden ----------

  private drawSectionTitle(title: string, keepWith = 14) {
    this.ensureSpace(8 + keepWith);
    this.font(10.5, "bold", INK);
    this.doc.text(title, MARGIN, this.y + 4);
    this.y += 7.5;
  }

  private drawWorkersTable() {
    const r = this.report;
    const workers = r.workers.filter((w) => w.name.trim() || workerTotal(w) > 0);
    const nameW = 54;
    const sumW = 22;
    const dayW = (CONTENT_W - nameW - sumW) / WEEKDAYS.length;
    const colX = (i: number) => MARGIN + nameW + i * dayW;
    const sumRight = MARGIN + CONTENT_W - 2;
    const days = workWeekDays(r.dateFrom);
    const headerH = days.length ? 10.5 : 7.5;
    const nameLineH = 9 * PT_TO_MM * 1.2;

    const rows = workers.map((w) => {
      this.font(9);
      const lines = this.wrap(w.name.trim() || "–", nameW - 4, 3);
      return { worker: w, lines, height: Math.max(7, 3.2 + lines.length * nameLineH + 1.2) };
    });

    const drawHeader = () => {
      this.doc.setFillColor(...SOFT_FILL);
      this.doc.rect(MARGIN, this.y, CONTENT_W, headerH, "F");
      this.font(8, "bold", INK);
      this.doc.text("Monteur", MARGIN + 2, this.y + 5);
      WEEKDAYS.forEach((day, i) => {
        this.font(8, "bold", INK);
        this.doc.text(WEEKDAY_SHORT[day], colX(i) + dayW / 2, this.y + 5, { align: "center" });
        if (days[i]) {
          this.font(6.5, "normal", MUTED);
          this.doc.text(formatDayMonth(days[i]), colX(i) + dayW / 2, this.y + 8.6, { align: "center" });
        }
      });
      this.font(8, "bold", INK);
      this.doc.text("Summe", sumRight, this.y + 5, { align: "right" });
      this.hLine(this.y + headerH, INK, 0.4);
      this.y += headerH;
    };

    const firstRowH = rows[0]?.height ?? 7;
    this.drawSectionTitle("Monteure und Arbeitszeiten", headerH + firstRowH + 8);
    drawHeader();

    if (rows.length === 0) {
      this.font(9, "normal", MUTED);
      this.doc.text("Keine Monteure eingetragen", MARGIN + 2, this.y + 4.8);
      this.hLine(this.y + 7);
      this.y += 7;
    }
    rows.forEach(({ worker, lines, height }, index) => {
      // Letzte Zeile bleibt mit der Summenzeile zusammen.
      const needed = height + (index === rows.length - 1 ? 8 : 0);
      if (this.y + needed > CONTENT_BOTTOM) {
        this.newPage();
        drawHeader();
      }
      this.font(9, "normal", INK);
      this.doc.text(lines, MARGIN + 2, this.y + 4.6, { lineHeightFactor: 1.2 });
      WEEKDAYS.forEach((day, i) => {
        const raw = worker.hours[day].trim();
        this.font(9, "normal", raw ? INK : RULE);
        this.doc.text(raw || "–", colX(i) + dayW / 2, this.y + 4.6, { align: "center" });
      });
      this.font(9, "bold", INK);
      this.doc.text(formatHours(workerTotal(worker)), sumRight, this.y + 4.6, { align: "right" });
      this.hLine(this.y + height, RULE, 0.2);
      this.y += height;
    });

    // Summenzeile
    const all = rows.map((row) => row.worker);
    this.hLine(this.y, GOLD, 0.5);
    this.font(8.5, "bold", INK);
    this.doc.text("Gesamtstunden", MARGIN + 2, this.y + 5);
    WEEKDAYS.forEach((day, i) => {
      const total = dayTotal(all, day);
      this.font(8.5, "bold", total ? INK : RULE);
      this.doc.text(total ? formatHours(total) : "–", colX(i) + dayW / 2, this.y + 5, { align: "center" });
    });
    this.font(10, "bold", INK);
    this.doc.text(`${formatHours(reportTotal(r))} Std.`, sumRight, this.y + 5.2, { align: "right" });
    this.y += 7 + 6;
  }

  // ---------- Fließtext ----------

  private drawParagraph(text: string, minLines = 0) {
    const lineH = 5.4;
    this.font(10, "normal", INK);
    const lines = text.trim() ? this.wrap(text.trim(), CONTENT_W) : [];
    const total = Math.max(lines.length, minLines);
    for (let i = 0; i < total; i++) {
      if (this.y + lineH > CONTENT_BOTTOM) {
        this.newPage();
        this.font(10, "normal", INK);
      }
      if (lines[i]) this.doc.text(lines[i], MARGIN, this.y + 3.9);
      this.hLine(this.y + lineH, LINE, 0.15);
      this.y += lineH;
    }
    this.y += 5;
  }

  private drawDescription() {
    this.drawSectionTitle("Arbeitsbericht: Folgende Arbeiten wurden ausgeführt", 11);
    this.drawParagraph(this.report.description, 3);
  }

  // ---------- Status ----------

  private drawRadio(x: number, y: number, checked: boolean, label: string): number {
    this.doc.setDrawColor(...GOLD);
    this.doc.setLineWidth(0.45);
    this.doc.circle(x + 2.2, y, 2.2, "S");
    if (checked) {
      this.doc.setFillColor(...INK);
      this.doc.circle(x + 2.2, y, 1.25, "F");
    }
    this.font(10, checked ? "bold" : "normal", checked ? INK : MUTED);
    this.doc.text(label, x + 6.5, y + 1.3);
    return 6.5 + this.doc.getTextWidth(label);
  }

  private drawCompletion() {
    this.ensureSpace(9);
    const c = this.report.completion;
    const y = this.y + 3;
    const w = this.drawRadio(MARGIN, y, c === "abgeschlossen", "Arbeiten abgeschlossen");
    this.drawRadio(MARGIN + w + 14, y, c === "weitere_arbeiten", "Weitere Arbeiten erforderlich");
    this.y += 9;

    if (c === "weitere_arbeiten" && this.report.followUpNotes.trim()) {
      this.ensureSpace(13);
      this.font(7.5, "bold", MUTED);
      this.doc.text("NOCH ERFORDERLICHE ARBEITEN / HINWEISE", MARGIN, this.y + 3, { charSpace: 0.3 });
      this.y += 5;
      this.drawParagraph(this.report.followUpNotes);
    } else {
      this.y += 2;
    }
  }

  // ---------- Unterschriften ----------

  /** Zeichnet die Unterschrift als Vektor (scharf in jeder Vergrößerung), sonst als Bild. Nie verzerrt. */
  private drawSignature(sig: Signature | null, x: number, y: number, w: number, h: number) {
    if (!sig) return;
    const target = { x, y, width: w, height: h };
    if (hasStrokes(sig)) {
      const bounds = strokesBounds(sig.strokes)!;
      const pad = 4; // px Rand um die Striche
      const source = { width: bounds.width + 2 * pad, height: bounds.height + 2 * pad };
      // Nicht stärker vergrößern als „ganzes Feld auf Box“ × 1,6 – kleine Kürzel bleiben klein.
      const natural = Math.min(w / sig.width, h / sig.height);
      const { scale, offsetX, offsetY } = fitContain(source, target, natural * 1.6);
      const tx = (px: number) => offsetX + (px - bounds.x + pad) * scale;
      const ty = (py: number) => offsetY + (py - bounds.y + pad) * scale;
      this.doc.setDrawColor(17, 17, 17);
      this.doc.setLineWidth(Math.min(0.7, Math.max(0.35, 2.4 * scale)));
      this.doc.setLineCap("round");
      this.doc.setLineJoin("round");
      for (const stroke of sig.strokes) {
        if (stroke.length === 2) {
          this.doc.setFillColor(17, 17, 17);
          this.doc.circle(tx(stroke[0]), ty(stroke[1]), 0.25, "F");
          continue;
        }
        const segments: [number, number][] = [];
        for (let i = 2; i + 1 < stroke.length; i += 2) {
          segments.push([(stroke[i] - stroke[i - 2]) * scale, (stroke[i + 1] - stroke[i - 1]) * scale]);
        }
        this.doc.lines(segments, tx(stroke[0]), ty(stroke[1]), [1, 1], "S", false);
      }
      this.doc.setLineCap("butt");
      return;
    }
    try {
      const { scale, offsetX, offsetY } = fitContain({ width: sig.width, height: sig.height }, target);
      this.doc.addImage(sig.dataUrl, "PNG", offsetX, offsetY, sig.width * scale, sig.height * scale, undefined, "SLOW");
    } catch {
      // Defekte Bilddaten sollen das PDF nicht verhindern.
    }
  }

  private drawSignatures() {
    const r = this.report;
    const sigH = 21;
    const gap = 12;
    const colW = (CONTENT_W - gap) / 2;
    const nameLineH = 4.2;
    const cols = [
      { x: MARGIN, label: "Unterschrift Monteur", name: r.monteurName, sig: r.monteurSignature },
      { x: MARGIN + colW + gap, label: "Unterschrift Kunde", name: r.kundeName, sig: r.kundeSignature },
    ].map((col) => {
      this.font(10);
      return { ...col, lines: this.wrap(col.name.trim() || "–", colW, 2) };
    });
    const maxNameLines = Math.max(...cols.map((c) => c.lines.length));
    const blockH = 12 + sigH + 9.6 + (maxNameLines - 1) * nameLineH + 1.5;
    // Ort/Datum und beide Unterschriften bleiben immer gemeinsam auf einer Seite.
    this.ensureSpace(blockH);
    const top = this.y;

    const ortDatum = [r.ort, formatDateDe(r.datum)].filter(Boolean).join(", ");
    this.font(7, "bold", MUTED);
    this.doc.text("ORT / DATUM", MARGIN, this.y + 3, { charSpace: 0.3 });
    this.font(10.5, "normal", ortDatum ? INK : MUTED);
    this.fitText(ortDatum || "–", MARGIN, this.y + 8.2, 80, 10.5, 8.5);
    this.hLine(this.y + 10.5, LINE, 0.2, MARGIN, MARGIN + 80);
    this.y += 12;

    for (const col of cols) {
      this.drawSignature(col.sig, col.x, this.y, colW, sigH);
      this.hLine(this.y + sigH + 0.8, INK, 0.35, col.x, col.x + colW);
      this.font(7, "bold", MUTED);
      this.doc.text(col.label.toUpperCase(), col.x, this.y + sigH + 4.6, { charSpace: 0.3 });
      if (col.sig) {
        this.font(6.5, "normal", MUTED);
        this.doc.text(`unterschrieben ${formatDateTimeDe(col.sig.signedAt)}`, col.x + colW, this.y + sigH + 4.6, { align: "right" });
      }
      this.font(10, "normal", col.name.trim() ? INK : MUTED);
      this.doc.text(col.lines, col.x, this.y + sigH + 9.6, { lineHeightFactor: nameLineH / (10 * PT_TO_MM) });
    }
    this.y = top + blockH;
    this.signatures = { page: this.doc.getCurrentPageInfo().pageNumber, top, bottom: this.y };
  }

  // ---------- Fußzeile ----------

  private footerColumns(): string[][] {
    const c = this.company;
    return [
      [c.name, `Inhaber: ${c.owner}`, ...companyAddressLines(c)],
      [
        [c.contact.phone, c.contact.mobile].filter(Boolean).join(" / "),
        `Steuer-Nr. ${c.tax.taxNumber}`,
        c.contact.website,
        c.contact.email,
      ],
      [
        `Bank ${c.bank.name}`,
        [c.bank.accountNumber && `Konto ${c.bank.accountNumber}`, c.bank.bankCode && `BLZ ${c.bank.bankCode}`]
          .filter(Boolean)
          .join(" · "),
        `BIC ${c.bank.bic}`,
        `IBAN ${formatIban(c.bank.iban)}`,
      ],
    ].map((lines) => lines.filter(Boolean).slice(0, PDF_LAYOUT.footerMaxLines));
  }

  private drawFooters() {
    const L = PDF_LAYOUT;
    const pages = this.doc.getNumberOfPages();
    const gap = 5;
    const colW = (CONTENT_W - 2 * gap) / 3;
    const columns = this.footerColumns();
    const left = [this.numberLabel() ? `Arbeitsbericht ${this.numberLabel()}` : "Arbeitsbericht", this.report.bauvorhaben]
      .filter(Boolean)
      .join(" · ");

    for (let page = 1; page <= pages; page++) {
      this.doc.setPage(page);
      this.hLine(L.footerTop, GOLD, 0.4);
      columns.forEach((lines, i) => {
        const x = MARGIN + i * (colW + gap);
        this.doc.setFillColor(...GOLD);
        this.doc.circle(x + 1.1, L.footerTop, 1.1, "F");
        lines.forEach((line, j) => {
          const strong = j === 0 && i !== 1;
          this.font(L.footerFontSize, strong ? "bold" : "normal", strong ? INK : MUTED);
          this.fitText(line, x, L.footerFirstBaseline + j * L.footerLineHeight, colW, L.footerFontSize, 6);
        });
      });

      // Eigene Zeile für Seitenzahl – klar getrennt von den Bankdaten.
      this.hLine(L.footerDivider, LINE, 0.15);
      const pageLabel = `Seite ${page} von ${pages}`;
      this.font(7, "normal", MUTED);
      const pageW = this.doc.getTextWidth(pageLabel);
      this.doc.text(pageLabel, PAGE_W - MARGIN, L.footerPageRowBaseline, { align: "right" });
      this.font(7, "normal", MUTED);
      this.doc.text(this.ellipsize(left, CONTENT_W - pageW - 10), MARGIN, L.footerPageRowBaseline);
    }
  }

  render(): PdfLayoutInfo {
    this.drawFirstHeader();
    this.drawMasterData();
    this.drawWorkersTable();
    this.drawDescription();
    this.drawCompletion();
    this.drawSignatures();
    this.markContent();
    this.drawFooters();
    return {
      pages: this.doc.getNumberOfPages(),
      contentBottomByPage: this.contentBottomByPage,
      signaturesPage: this.signatures.page,
      signaturesTop: this.signatures.top,
      signaturesBottom: this.signatures.bottom,
    };
  }
}

/** Untere Kante der Firmendaten-Spalten – muss oberhalb der Seitenzahl-Zeile liegen. */
export function footerColumnsBottom(): number {
  const L = PDF_LAYOUT;
  return L.footerFirstBaseline + (L.footerMaxLines - 1) * L.footerLineHeight + L.footerFontSize * PT_TO_MM * 0.3;
}

export interface GeneratedPdf {
  doc: JsPdf;
  fileName: string;
  layout: PdfLayoutInfo;
}

export interface PdfOptions {
  company?: CompanyConfig;
  /** Logo als Data-URL; `undefined` = aus company.logo.src laden, `null` = ohne Logo. */
  logoDataUrl?: string | null;
  /** Schriftdaten; `undefined` = aus /fonts laden, `null` = PDF-Standardschrift (Helvetica). */
  fonts?: PdfFontData | null;
  /** Für Tests abschaltbar, damit der PDF-Text lesbar bleibt. */
  compress?: boolean;
}

/** Baut das PDF (im Browser; jsPDF wird erst bei Bedarf geladen). */
export async function generateReportPdf(report: WorkReport, options: PdfOptions = {}): Promise<GeneratedPdf> {
  const company = options.company ?? companyConfig;
  const [{ jsPDF }, logo, fonts] = await Promise.all([
    import("jspdf"),
    options.logoDataUrl !== undefined ? Promise.resolve(options.logoDataUrl) : loadImageAsDataUrl(company.logo.src),
    options.fonts !== undefined ? Promise.resolve(options.fonts) : loadFonts(),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: options.compress ?? true });
  doc.setProperties({
    title: ["Arbeitsbericht", report.reportNumber, report.bauvorhaben].filter(Boolean).join(" "),
    subject: "Arbeitsbericht",
    author: company.name,
    creator: company.shortName,
  });
  const fontFamily = fonts ? registerFonts(doc, fonts) : "helvetica";
  const layout = new ReportPdfWriter(doc, report, company, logo, fontFamily).render();
  return { doc, fileName: reportPdfFileName(report), layout };
}

/** Erzeugt das PDF und startet den Download. */
export async function downloadReportPdf(report: WorkReport): Promise<string> {
  const { doc, fileName } = await generateReportPdf(report);
  doc.save(fileName);
  return fileName;
}
