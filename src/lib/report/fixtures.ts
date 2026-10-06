/**
 * Beispielberichte für Tests und Vorschau-PDFs (kurz, normal, sehr lang).
 * Keine echten Kundendaten.
 */
import { createEmptyReport, createWorker } from "./factory";
import { deriveStatus } from "./status";
import type { Signature, WorkReport, WorkerEntry } from "./types";

/** Eine Unterschrift als Vektor-Striche (Wellenlinie mit Schwung) im 340×176-Feld. */
export function sampleSignature(seed = 0): Signature {
  const main: number[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    main.push(40 + t * 240, 110 - 30 * Math.sin(t * 9 + seed) * (1 - t * 0.4));
  }
  const dash = [70, 140, 150, 136, 230, 142];
  return { dataUrl: "", width: 340, height: 176, strokes: [main, dash], signedAt: "2026-10-06T15:30:00.000Z" };
}

function worker(name: string, hours: Partial<WorkerEntry["hours"]>): WorkerEntry {
  return { ...createWorker(name), hours: { ...createWorker().hours, ...hours } };
}

function base(): WorkReport {
  const r = createEmptyReport("2026-10-06");
  r.createdAt = "2026-10-06T07:12:00.000Z";
  r.updatedAt = r.createdAt;
  r.reportNumber = "AB-2026-0001";
  r.ort = "Herford";
  r.datum = "2026-10-06";
  return r;
}

const finish = (r: WorkReport): WorkReport => ({ ...r, status: deriveStatus(r) });

export function shortReport(): WorkReport {
  const r = base();
  r.bauvorhaben = "Familie Schneider";
  r.objekt = "Bergstr. 3";
  r.artDerArbeiten = "Wartung";
  r.workers = [worker("Ali Issat", { di: "2,5" })];
  r.description = "Heizungswartung durchgeführt, Brenner gereinigt, Anlage geprüft.";
  r.completion = "abgeschlossen";
  r.monteurName = "Ali Issat";
  r.monteurSignature = sampleSignature(0);
  r.kundeName = "Petra Schneider";
  r.kundeSignature = sampleSignature(1.3);
  return finish(r);
}

export function normalReport(): WorkReport {
  const r = base();
  r.reportNumber = "AB-2026-0002";
  r.bauvorhaben = "Familie Müller – Heizungstausch Einfamilienhaus";
  r.objekt = "Lindenstraße 12, 32051 Herford / KSt. 2026-118";
  r.artDerArbeiten = "Austausch Gas-Brennwertkessel inkl. Umwälzpumpe";
  r.workers = [
    worker("Ali Issat", { mo: "8", di: "7,5", mi: "8", do: "8", fr: "6" }),
    worker("Ben Krüger", { mo: "8", di: "8", mi: "8", do: "8", fr: "6" }),
    worker("Carl Özdemir", { mi: "4", do: "4" }),
  ];
  r.description = [
    "Alten Gas-Heizkessel außer Betrieb genommen, entleert und demontiert.",
    "Neuen Gas-Brennwertkessel montiert und an Vor- und Rücklauf angeschlossen.",
    "Hocheffizienz-Umwälzpumpe eingebaut, Ausdehnungsgefäß geprüft und Vordruck eingestellt.",
    "Abgasleitung angepasst, Kondensatleitung verlegt und Anlage befüllt, entlüftet sowie auf Dichtheit geprüft.",
    "Inbetriebnahme durchgeführt, Kunde in die Bedienung eingewiesen.",
  ].join("\n");
  r.completion = "weitere_arbeiten";
  r.followUpNotes = "Thermostatventil im Bad ist bestellt; Einbau in KW 42.";
  r.monteurName = "Ali Issat";
  r.monteurSignature = sampleSignature(0);
  r.kundeName = "Jörg Müller";
  r.kundeSignature = sampleSignature(2.1);
  return finish(r);
}

export function longReport(): WorkReport {
  const r = normalReport();
  r.reportNumber = "AB-2026-0003";
  r.bauvorhaben =
    "Wohnungseigentümergemeinschaft Herforder Straße 120–128 – Sanierung der gesamten Heizungs- und Trinkwasseranlage einschließlich Strangsanierung in allen Treppenhäusern";
  r.objekt = "Herforder Straße 120–128, 32051 Herford, Kellergeschoss Technikzentrale und Treppenhäuser A bis E / KSt. 2026-0042-SAN";
  r.artDerArbeiten = "Strangsanierung, Heizungsumbau, hydraulischer Abgleich, Trinkwasser-Hygienespülung";
  r.workers = [
    worker("Maximilian-Alexander von Hohenstein-Wittgenstein", { mo: "9,5", di: "9,5", mi: "9,5", do: "9,5", fr: "8", sa: "4" }),
    worker("Ben Krüger", { mo: "8", di: "8", mi: "8", do: "8", fr: "8" }),
    worker("Carl Özdemir", { mo: "8", di: "8", mi: "8", do: "8", fr: "8" }),
    worker("Dragan Petrović", { mo: "7,5", di: "7,5", mi: "7,5", do: "7,5", fr: "7,5" }),
    worker("Emil Fischer (Azubi, 2. Lehrjahr)", { mo: "8", di: "8", mi: "8", do: "8", fr: "6,5" }),
  ];
  r.description = Array.from(
    { length: 34 },
    (_, i) =>
      `${i + 1}. Strang ${String.fromCharCode(65 + (i % 5))}${i + 1}: Absperrarmaturen erneuert, Leitungen gespült, Druckprobe mit 1,5-fachem Betriebsdruck durchgeführt und protokolliert; Dämmung nach GEG ergänzt.`,
  ).join("\n");
  r.description += "\nHinweis: Wärmeerzeugungsanlagenkomplettsanierungsdokumentationsunterlagen werden nachgereicht.";
  r.followUpNotes = Array.from({ length: 6 }, (_, i) => `Restarbeit ${i + 1}: Heizkörper in Wohnung ${i + 3} tauschen, Termin mit Mieter abstimmen.`).join("\n");
  r.kundeName = "Hausverwaltung Westfalen Immobilien GmbH & Co. KG, vertreten durch Frau Dr. Annegret Müller-Lüdenscheidt";
  return finish(r);
}
