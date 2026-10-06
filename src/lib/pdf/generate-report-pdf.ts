import type { jsPDF as JsPdf } from "jspdf";

import { companyAddressLines, companyConfig, formatIban, type CompanyConfig } from "@/config/company-config";
import { reportPdfFileName } from "@/lib/report/filename";
import { dayTotal, formatHours, reportTotal, workerTotal } from "@/lib/report/hours";
import { WEEKDAYS, WEEKDAY_LABELS, type Signature, type WorkReport } from "@/lib/report/types";
import { formatDateDe, formatDateTimeDe, parseIsoDay, workWeekRange } from "@/lib/util/dates";

/*
 * Layout in Millimetern, DIN A4 hochformat.
 * Bewusst konservativ: weiße Fläche, feine Linien, Akzent in Gold wie auf dem Papierformular.
 */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CONTENT_BOTTOM = 268;
const FOOTER_TOP = 273;

type Rgb = [number, number, number];
const INK: Rgb = [38, 34, 35];
const TEXT: Rgb = [38, 42, 52];
const MUTED: Rgb = [110, 116, 128];
const LINE: Rgb = [205, 209, 216];
const SOFT_FILL: Rgb = [244, 245, 247];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
  private y = MARGIN;
  private readonly gold: Rgb;

  constructor(
    private readonly doc: JsPdf,
    private readonly report: WorkReport,
    private readonly company: CompanyConfig,
    private readonly logo: string | null,
  ) {
    this.gold = hexToRgb(company.brand.accent);
  }

  // ---------- Grundbausteine ----------

  private font(size: number, style: "normal" | "bold" = "normal", color: Rgb = TEXT) {
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  private hLine(y: number, color: Rgb = LINE, width = 0.2, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(width);
    this.doc.line(x1, y, x2, y);
  }

  private wrap(text: string, width: number): string[] {
    return this.doc.splitTextToSize(text.replace(/\r\n/g, "\n"), width) as string[];
  }

  private newPage() {
    this.doc.addPage();
    this.drawContinuationHeader();
  }

  private ensureSpace(height: number) {
    if (this.y + height > CONTENT_BOTTOM) this.newPage();
  }

  // ---------- Kopf ----------

  private drawFirstHeader() {
    const logoSize = 27;
    if (this.logo) {
      this.doc.addImage(this.logo, "PNG", PAGE_W - MARGIN - logoSize, 10, logoSize, logoSize);
    }

    this.font(8, "bold", this.gold);
    this.doc.text(this.company.name.toUpperCase(), MARGIN, 18, { charSpace: 0.6 });

    this.font(24, "bold", INK);
    this.doc.text("Arbeitsbericht", MARGIN, 28.5);

    const meta = [
      this.report.number ? `Bericht-Nr. ${this.report.number}` : null,
      `Erstellt am ${formatDateTimeDe(this.report.createdAt)}`,
    ]
      .filter(Boolean)
      .join("   ·   ");
    this.font(8.5, "normal", MUTED);
    this.doc.text(meta, MARGIN, 35);

    this.hLine(41, this.gold, 0.6);
    this.y = 47;
  }

  private drawContinuationHeader() {
    this.font(8, "bold", this.gold);
    this.doc.text(this.company.name.toUpperCase(), MARGIN, 16, { charSpace: 0.6 });
    this.font(10, "bold", INK);
    const title = this.report.bauvorhaben ? `Arbeitsbericht – ${this.report.bauvorhaben}` : "Arbeitsbericht";
    this.doc.text(`${this.wrap(title, CONTENT_W - 30)[0]} (Fortsetzung)`, MARGIN, 22);
    this.hLine(26, this.gold, 0.4);
    this.y = 33;
  }

  // ---------- Stammdaten ----------

  /** Ein Feld „Beschriftung über Wert“ mit Linie darunter. Gibt die Höhe zurück. */
  private measureField(value: string, width: number): number {
    this.font(10.5);
    const lines = this.wrap(value || "–", width);
    return 9 + (lines.length - 1) * 4.6 + 3;
  }

  private drawField(x: number, y: number, width: number, height: number, label: string, value: string) {
    this.font(7, "bold", MUTED);
    this.doc.text(label.toUpperCase(), x, y + 3, { charSpace: 0.3 });
    this.font(10.5, "normal", value ? TEXT : MUTED);
    this.doc.text(this.wrap(value || "–", width), x, y + 8.5, { lineHeightFactor: 1.25 });
    this.hLine(y + height, LINE, 0.2, x, x + width);
  }

  private drawFieldRow(fields: { label: string; value: string; width: number }[]) {
    const gap = 8;
    const height = Math.max(...fields.map((f) => this.measureField(f.value, f.width)));
    this.ensureSpace(height + 4);
    let x = MARGIN;
    for (const field of fields) {
      this.drawField(x, this.y, field.width, height, field.label, field.value);
      x += field.width + gap;
    }
    this.y += height + 4;
  }

  private drawMasterData() {
    const r = this.report;
    const period = [formatDateDe(r.dateFrom), formatDateDe(r.dateTo)].filter(Boolean).join(" – ");
    const half = (CONTENT_W - 8) / 2;

    this.drawFieldRow([{ label: "Bauvorhaben", value: r.bauvorhaben, width: CONTENT_W }]);
    this.drawFieldRow([
      { label: "KW", value: r.kw, width: 22 },
      { label: "Zeitraum", value: period, width: half - 30 },
      { label: "Objekt / KSt.-Nr.", value: r.objekt, width: half },
    ]);
    this.drawFieldRow([{ label: "Art der Arbeiten", value: r.artDerArbeiten, width: CONTENT_W }]);
    this.y += 3;
  }

  // ---------- Monteure / Stunden ----------

  private drawSectionTitle(title: string) {
    this.ensureSpace(14);
    this.font(10.5, "bold", INK);
    this.doc.text(title, MARGIN, this.y + 4);
    this.y += 8;
  }

  private drawWorkersTable() {
    const r = this.report;
    const workers = r.workers.filter((w) => w.name.trim() || workerTotal(w) > 0);
    const nameW = 52;
    const sumW = 22;
    const dayW = (CONTENT_W - nameW - sumW) / WEEKDAYS.length;
    const colX = (i: number) => MARGIN + nameW + i * dayW;
    const sumX = MARGIN + CONTENT_W - sumW;

    const week = workWeekRange(r.dateFrom);
    const monday = week ? parseIsoDay(week.from) : null;
    const dayDate = (i: number) => {
      if (!monday) return "";
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
    };

    const headerH = monday ? 11 : 8;
    const rowH = 7.5;
    this.drawSectionTitle("Monteure und Arbeitszeiten");
    this.ensureSpace(headerH + rowH * Math.max(1, workers.length) + rowH + 4);

    const drawHeader = () => {
      this.doc.setFillColor(...SOFT_FILL);
      this.doc.rect(MARGIN, this.y, CONTENT_W, headerH, "F");
      this.font(8, "bold", INK);
      this.doc.text("Monteur", MARGIN + 2, this.y + 5.2);
      WEEKDAYS.forEach((day, i) => {
        this.font(8, "bold", INK);
        this.doc.text(WEEKDAY_LABELS[day].slice(0, 2), colX(i) + dayW / 2, this.y + 5.2, { align: "center" });
        if (monday) {
          this.font(6.5, "normal", MUTED);
          this.doc.text(dayDate(i), colX(i) + dayW / 2, this.y + 9, { align: "center" });
        }
      });
      this.font(8, "bold", INK);
      this.doc.text("Summe", sumX + sumW - 2, this.y + 5.2, { align: "right" });
      this.hLine(this.y + headerH, INK, 0.4);
      this.y += headerH;
    };

    drawHeader();

    const rows = workers.length > 0 ? workers : null;
    if (!rows) {
      this.font(9, "normal", MUTED);
      this.doc.text("Keine Monteure eingetragen", MARGIN + 2, this.y + 5);
      this.hLine(this.y + rowH);
      this.y += rowH;
    } else {
      for (const worker of rows) {
        if (this.y + rowH * 2 > CONTENT_BOTTOM) {
          this.newPage();
          drawHeader();
        }
        this.font(9, "normal", TEXT);
        this.doc.text(this.wrap(worker.name || "–", nameW - 4)[0], MARGIN + 2, this.y + 5);
        WEEKDAYS.forEach((day, i) => {
          const raw = worker.hours[day].trim();
          this.font(9, "normal", raw ? TEXT : LINE);
          this.doc.text(raw || "–", colX(i) + dayW / 2, this.y + 5, { align: "center" });
        });
        this.font(9, "bold", INK);
        this.doc.text(formatHours(workerTotal(worker)), sumX + sumW - 2, this.y + 5, { align: "right" });
        this.hLine(this.y + rowH);
        this.y += rowH;
      }
    }

    // Summenzeile
    const allWorkers = rows ?? [];
    this.hLine(this.y, this.gold, 0.5);
    this.font(8.5, "bold", INK);
    this.doc.text("Gesamtstunden", MARGIN + 2, this.y + 5.2);
    WEEKDAYS.forEach((day, i) => {
      const total = dayTotal(allWorkers, day);
      this.font(8.5, "bold", total ? INK : LINE);
      this.doc.text(total ? formatHours(total) : "–", colX(i) + dayW / 2, this.y + 5.2, { align: "center" });
    });
    this.font(10, "bold", INK);
    this.doc.text(`${formatHours(reportTotal(r))} Std.`, sumX + sumW - 2, this.y + 5.4, { align: "right" });
    this.y += rowH + 8;
  }

  // ---------- Fließtext ----------

  private drawParagraph(text: string, minLines = 0) {
    const lineH = 5;
    this.font(10, "normal", TEXT);
    const lines = text.trim() ? this.wrap(text.trim(), CONTENT_W) : [];
    const total = Math.max(lines.length, minLines);
    for (let i = 0; i < total; i++) {
      if (this.y + lineH > CONTENT_BOTTOM) {
        this.newPage();
        this.font(10, "normal", TEXT);
      }
      if (lines[i]) this.doc.text(lines[i], MARGIN, this.y + 3.8);
      this.hLine(this.y + lineH + 0.6, [230, 232, 236], 0.15);
      this.y += lineH + 0.6;
    }
    this.y += 6;
  }

  private drawDescription() {
    this.drawSectionTitle("Arbeitsbericht: Folgende Arbeiten wurden ausgeführt");
    this.drawParagraph(this.report.description, 4);
  }

  // ---------- Status ----------

  private drawRadio(x: number, y: number, checked: boolean, label: string): number {
    this.doc.setDrawColor(...this.gold);
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
    this.ensureSpace(14);
    const c = this.report.completion;
    const y = this.y + 3;
    const w = this.drawRadio(MARGIN, y, c === "abgeschlossen", "Arbeiten abgeschlossen");
    this.drawRadio(MARGIN + w + 14, y, c === "weitere_arbeiten", "Weitere Arbeiten erforderlich");
    this.y += 10;

    if (c === "weitere_arbeiten" && this.report.followUpNotes.trim()) {
      this.ensureSpace(16);
      this.font(8, "bold", MUTED);
      this.doc.text("NOCH ERFORDERLICHE ARBEITEN / HINWEISE", MARGIN, this.y + 3, { charSpace: 0.3 });
      this.y += 6;
      this.drawParagraph(this.report.followUpNotes);
    } else {
      this.y += 2;
    }
  }

  // ---------- Unterschriften ----------

  private drawSignatureImage(sig: Signature | null, x: number, y: number, w: number, h: number) {
    if (!sig) return;
    const ratio = sig.width / sig.height || 3;
    let drawW = w;
    let drawH = w / ratio;
    if (drawH > h) {
      drawH = h;
      drawW = h * ratio;
    }
    try {
      this.doc.addImage(sig.dataUrl, "PNG", x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
    } catch {
      // Defekte Bilddaten sollen das PDF nicht verhindern.
    }
  }

  private drawSignatures() {
    const r = this.report;
    const blockH = 48;
    this.ensureSpace(blockH);

    const ortDatum = [r.ort, formatDateDe(r.datum)].filter(Boolean).join(", ");
    this.font(7, "bold", MUTED);
    this.doc.text("ORT / DATUM", MARGIN, this.y + 3, { charSpace: 0.3 });
    this.font(10.5, "normal", ortDatum ? TEXT : MUTED);
    this.doc.text(ortDatum || "–", MARGIN, this.y + 8.5);
    this.hLine(this.y + 11, LINE, 0.2, MARGIN, MARGIN + 80);
    this.y += 13;

    const gap = 12;
    const colW = (CONTENT_W - gap) / 2;
    const sigH = 22;
    const cols = [
      { x: MARGIN, label: "Unterschrift Monteur", name: r.monteurName, sig: r.monteurSignature },
      { x: MARGIN + colW + gap, label: "Unterschrift Kunde", name: r.kundeName, sig: r.kundeSignature },
    ];
    for (const col of cols) {
      this.drawSignatureImage(col.sig, col.x, this.y, colW, sigH);
      this.hLine(this.y + sigH + 1, INK, 0.35, col.x, col.x + colW);
      this.font(7, "bold", MUTED);
      this.doc.text(col.label.toUpperCase(), col.x, this.y + sigH + 5, { charSpace: 0.3 });
      this.font(10, "normal", col.name ? TEXT : MUTED);
      this.doc.text(col.name || "–", col.x, this.y + sigH + 10);
      if (col.sig) {
        this.font(7, "normal", MUTED);
        this.doc.text(`unterschrieben ${formatDateTimeDe(col.sig.signedAt)}`, col.x + colW, this.y + sigH + 10, {
          align: "right",
        });
      }
    }
    this.y += sigH + 12;
  }

  // ---------- Fußzeile ----------

  private drawFooters() {
    const c = this.company;
    const pages = this.doc.getNumberOfPages();
    const colW = CONTENT_W / 3;
    const columns: string[][] = [
      [c.name, `Inhaber: ${c.owner}`, ...companyAddressLines(c)],
      [
        [c.contact.phone, c.contact.mobile].filter(Boolean).join(" / "),
        `Steuer-Nr. ${c.tax.taxNumber}`,
        c.contact.website,
        c.contact.email,
      ],
      [
        `Bank: ${c.bank.name}`,
        [c.bank.accountNumber && `Konto ${c.bank.accountNumber}`, c.bank.bankCode && `BLZ ${c.bank.bankCode}`]
          .filter(Boolean)
          .join(" · "),
        `BIC ${c.bank.bic}`,
        `IBAN ${formatIban(c.bank.iban)}`,
      ],
    ];

    for (let page = 1; page <= pages; page++) {
      this.doc.setPage(page);
      this.hLine(FOOTER_TOP, this.gold, 0.4);
      columns.forEach((lines, i) => {
        const x = MARGIN + i * colW;
        this.doc.setFillColor(...this.gold);
        this.doc.circle(x + 1.2, FOOTER_TOP, 1.2, "F");
        lines.filter(Boolean).forEach((line, j) => {
          this.font(7, j === 0 && i === 0 ? "bold" : "normal", j === 0 && i === 0 ? INK : MUTED);
          this.doc.text(line, x, FOOTER_TOP + 5.5 + j * 3.4);
        });
      });
      this.font(7, "normal", MUTED);
      this.doc.text(`Seite ${page} von ${pages}`, PAGE_W / 2, PAGE_H - 3.5, { align: "center" });
    }
  }

  render() {
    this.drawFirstHeader();
    this.drawMasterData();
    this.drawWorkersTable();
    this.drawDescription();
    this.drawCompletion();
    this.drawSignatures();
    this.drawFooters();
  }
}

export interface GeneratedPdf {
  doc: JsPdf;
  fileName: string;
}

/** Baut das PDF im Browser (jsPDF wird erst bei Bedarf geladen). */
export async function generateReportPdf(
  report: WorkReport,
  company: CompanyConfig = companyConfig,
): Promise<GeneratedPdf> {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadImageAsDataUrl(company.logo.src)]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.setProperties({
    title: `Arbeitsbericht ${report.bauvorhaben}`.trim(),
    subject: "Arbeitsbericht",
    author: company.name,
    creator: company.shortName,
  });
  new ReportPdfWriter(doc, report, company, logo).render();
  return { doc, fileName: reportPdfFileName(report) };
}

/** Erzeugt das PDF und startet den Download. */
export async function downloadReportPdf(report: WorkReport): Promise<string> {
  const { doc, fileName } = await generateReportPdf(report);
  doc.save(fileName);
  return fileName;
}
